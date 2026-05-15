/**
 * @module AuditService
 * @description Orchestrates the dual-write audit pipeline:
 *   1. Fetch prev_hash from DB (serialized per-tenant via advisory lock)
 *   2. Compute current_hash over canonical payload
 *   3. Write to S3/WORM (primary, immutable source of truth)
 *   4. Write to DB (secondary, query cache with RLS)
 *
 * WRITE ORDER INVARIANT:
 *   S3 write MUST succeed before DB write is attempted.
 *   If S3 write fails → abort, do not write to DB, surface error to caller.
 *   If DB write fails after S3 write → S3 record is orphaned but NOT lost.
 *     A reconciliation job (SF-ARCH-009) will detect DB/S3 divergence and
 *     replay the S3 record into DB. The chain is still valid.
 *   NEVER reverse this order.
 *
 * CONCURRENCY MODEL:
 *   Per-tenant advisory lock in Postgres ensures prev_hash reads are
 *   serialized within a tenant. Cross-tenant writes are fully parallel.
 *   Lock acquisition timeout: 5000ms. Callers must handle AuditLockTimeout.
 */

import { randomUUID } from "crypto";
import type {
  AuditEventPayload,
  AuditRecord,
  AuditServiceConfig,
  ChainVerificationResult,
} from "../types/audit.types";
import { GENESIS_SENTINEL } from "../types/audit.types";
import { computeHash, verifyRecordHash, buildS3Key } from "../lib/hasher";

// ─── Port Interfaces (Dependency Inversion) ───────────────────────────────────
// These are interfaces, not concrete implementations. Wire actual clients
// (aws-sdk S3, pg Pool) in the composition root (src/index.ts), not here.
// This keeps the service unit-testable without AWS or Postgres.

export interface AuditDbPort {
  /** Returns the most recent record for a tenant, or null if genesis. */
  getLatestRecord(tenantId: string): Promise<Pick<AuditRecord, "id" | "current_hash"> | null>;

  /** Inserts a new AuditRecord. Must enforce RLS — tenantId in JWT must match record.tenant_id. */
  insertRecord(record: AuditRecord): Promise<void>;

  /** Acquire a per-tenant advisory lock. Returns release function. */
  acquireChainLock(tenantId: string, timeoutMs: number): Promise<() => Promise<void>>;

  /** Fetch a page of records for chain verification. Ordered by created_at ASC. */
  getRecordsForVerification(tenantId: string, afterId: string | null, limit: number): Promise<AuditRecord[]>;
}

export interface AuditS3Port {
  /** Write record JSON to S3. Object Lock (WORM) must be enabled on the bucket. */
  putRecord(key: string, record: AuditRecord): Promise<void>;

  /** Read a record back from S3 for verification. */
  getRecord(key: string): Promise<AuditRecord>;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class AuditLockTimeoutError extends Error {
  constructor(tenantId: string) {
    super(`[AuditService] Chain lock timeout for tenant '${tenantId}' — high write contention`);
    this.name = "AuditLockTimeoutError";
  }
}

export class AuditS3WriteError extends Error {
  constructor(key: string, cause: unknown) {
    super(`[AuditService] S3 write failed for key '${key}'`);
    this.name = "AuditS3WriteError";
    this.cause = cause;
  }
}

export class AuditChainBrokenError extends Error {
  public readonly firstInvalidId: string;
  public readonly position: number;
  constructor(firstInvalidId: string, position: number) {
    super(`[AuditService] Chain integrity violation at record '${firstInvalidId}' (position ${position})`);
    this.name = "AuditChainBrokenError";
    this.firstInvalidId = firstInvalidId;
    this.position = position;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AuditService {
  private readonly config: AuditServiceConfig;
  private readonly db: AuditDbPort;
  private readonly s3: AuditS3Port;

  constructor(config: AuditServiceConfig, db: AuditDbPort, s3: AuditS3Port) {
    this.config = config;
    this.db = db;
    this.s3 = s3;
  }

  // ─── Write Path ─────────────────────────────────────────────────────────────

  /**
   * Emit a single audit event. This is the primary write entrypoint.
   *
   * @throws {AuditLockTimeoutError} if chain lock cannot be acquired in 5s
   * @throws {AuditS3WriteError} if S3 write fails (DB write is NOT attempted)
   */
  async emit(payload: AuditEventPayload): Promise<AuditRecord> {
    const tenantId = payload.tenant_id;
    const releaseLock = await this.db.acquireChainLock(tenantId, 5000);

    try {
      // 1. Fetch chain tip (serialized within lock)
      const latest = await this.db.getLatestRecord(tenantId);
      const prevHash = latest?.current_hash ?? GENESIS_SENTINEL;

      // 2. Compute hash
      const currentHash = computeHash(payload, prevHash, this.config.hmac_secret);

      // 3. Build record
      const id = this.generateRecordId();
      const s3Key = buildS3Key(
        this.config.s3_prefix,
        tenantId,
        id,
        payload.timestamp_utc
      );

      const record: AuditRecord = {
        id,
        tenant_id: tenantId,
        prev_hash: prevHash,
        current_hash: currentHash,
        payload,
        s3_key: s3Key,
        created_at: new Date().toISOString(),
      };

      // 4. S3 write FIRST — source of truth
      try {
        await this.s3.putRecord(s3Key, record);
      } catch (err) {
        throw new AuditS3WriteError(s3Key, err);
      }

      // 5. DB write second — query cache
      // If this fails, the reconciliation job handles replay from S3
      await this.db.insertRecord(record);

      return record;

    } finally {
      // Always release lock, even on error
      await releaseLock();
    }
  }

  // ─── Verification Path ──────────────────────────────────────────────────────

  /**
   * Verify the entire hash chain for a tenant.
   * Reads from DB (query cache). For forensic verification, use verifyFromS3().
   *
   * Time complexity: O(n) where n = number of records. For large tenants,
   * run this as a background job, not in the request path.
   */
  async verifyChain(tenantId: string): Promise<ChainVerificationResult> {
    const PAGE_SIZE = 500;
    let afterId: string | null = null;
    let expectedPrevHash = GENESIS_SENTINEL;
    let position = 0;
    let checkedCount = 0;
    const computedHashes = new Map<string, string>();

    while (true) {
      const page = await this.db.getRecordsForVerification(tenantId, afterId, PAGE_SIZE);
      if (page.length === 0) break;

      for (const record of page) {
        // Verify prev_hash linkage
        if (record.prev_hash !== expectedPrevHash) {
          return {
            valid: false,
            checked_count: checkedCount,
            first_invalid_id: record.id,
            first_invalid_position: position,
            computed_hashes: computedHashes,
          };
        }

        // Recompute hash from stored payload
        const recomputed = computeHash(
          record.payload,
          record.prev_hash,
          this.config.hmac_secret
        );
        computedHashes.set(record.id, recomputed);

        const valid = verifyRecordHash(
          record.payload,
          record.prev_hash,
          record.current_hash,
          this.config.hmac_secret
        );

        if (!valid) {
          return {
            valid: false,
            checked_count: checkedCount,
            first_invalid_id: record.id,
            first_invalid_position: position,
            computed_hashes: computedHashes,
          };
        }

        expectedPrevHash = record.current_hash;
        afterId = record.id;
        checkedCount++;
        position++;
      }

      if (page.length < PAGE_SIZE) break; // last page
    }

    return {
      valid: true,
      checked_count: checkedCount,
      first_invalid_id: null,
      first_invalid_position: null,
      computed_hashes: computedHashes,
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  /**
   * UUIDv7 preferred (time-ordered). Falling back to UUIDv4 until the
   * `uuidv7` package is confirmed in the dependency manifest.
   * TODO: SF-IMPL-003 — switch to uuidv7() for index locality.
   */
  private generateRecordId(): string {
    return randomUUID();
  }
}

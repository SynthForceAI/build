/**
 * @module hasher
 * @description HMAC-SHA256 hash computation for the audit chain.
 *
 * ARCHITECTURE DECISION — HMAC vs plain SHA-256:
 * Plain SHA-256 is deterministic but unauthenticated — anyone who reads the
 * payload can recompute the hash, making it trivial to forge a "valid" chain
 * after tampering. HMAC-SHA256 binds the hash to a secret key, so chain
 * validity can only be confirmed by Synthforce (or a customer given their
 * tenant key). This satisfies SOC2 CC6.1 (logical access) and provides
 * non-repudiation for compliance reports.
 *
 * KEY ROTATION: The hmac_secret should be rotated per tenant per quarter.
 * Rotation requires re-hashing historical records — this is a planned future
 * migration, not an MVP concern. Track in: SF-ARCH-007.
 */

import { createHmac } from "crypto";
import { canonicalize } from "./canonicalize";
import type { AuditEventPayload } from "../types/audit.types";
import { GENESIS_SENTINEL } from "../types/audit.types";

// ─── Hash Computation ─────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 of a canonicalized AuditEventPayload.
 *
 * The input to HMAC is:
 *   prev_hash + "|" + canonicalize(payload)
 *
 * Chaining prev_hash into the HMAC input (rather than just storing it as a
 * field) means you cannot reorder records without invalidating ALL subsequent
 * hashes. The pipe delimiter prevents length-extension ambiguity.
 */
export function computeHash(
  payload: AuditEventPayload,
  prevHash: string,
  secret: string
): string {
  const canonical = canonicalize(payload);
  const input = `${prevHash}|${canonical}`;

  return createHmac("sha256", secret)
    .update(input, "utf8")
    .digest("hex");
}

/**
 * Verify a single record's hash without trusting its stored current_hash.
 * Returns true only if recomputed hash === stored current_hash.
 */
export function verifyRecordHash(
  payload: AuditEventPayload,
  prevHash: string,
  storedHash: string,
  secret: string
): boolean {
  try {
    const recomputed = computeHash(payload, prevHash, secret);
    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(recomputed, storedHash);
  } catch {
    // Canonicalization failure means payload was tampered
    return false;
  }
}

/**
 * Validate a genesis record (first record in a tenant's chain).
 * Genesis records MUST reference GENESIS_SENTINEL as prev_hash.
 */
export function isGenesisRecord(prevHash: string): boolean {
  return prevHash === GENESIS_SENTINEL;
}

// ─── Timing-Safe String Compare ───────────────────────────────────────────────

/**
 * Constant-time string equality. Prevents timing side-channels on hash comparison.
 * Node's crypto.timingSafeEqual requires Buffer inputs of equal length.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const { timingSafeEqual: cryptoEqual } = require("crypto");
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return cryptoEqual(bufA, bufB);
}

// ─── S3 Key Generation ────────────────────────────────────────────────────────

/**
 * Construct a deterministic, time-ordered S3 object key.
 *
 * Format: {prefix}/{tenant_id}/{YYYY}/{MM}/{DD}/{record_id}.json
 *
 * Rationale:
 *   - Tenant prefix enables IAM bucket policies scoped per tenant
 *   - Date hierarchy enables S3 Lifecycle rules and efficient range queries
 *   - UUIDv7 record_id is time-ordered within a day partition
 *   - .json extension allows S3 Select for emergency forensic queries
 */
export function buildS3Key(
  prefix: string,
  tenantId: string,
  recordId: string,
  timestamp: string // ISO 8601 UTC
): string {
  const date = new Date(timestamp);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  return `${prefix}/${tenantId}/${yyyy}/${mm}/${dd}/${recordId}.json`;
}

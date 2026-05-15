/**
 * @testmodule AuditService + Canonicalize + Hasher
 * @description Full unit test suite. Zero external dependencies — all ports mocked.
 *
 * Test matrix:
 *   [canonicalize]  key ordering, type guards, edge cases
 *   [hasher]        hash consistency, chain linkage, timing-safe compare
 *   [AuditService]  write path, lock semantics, S3-first ordering, verification
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { canonicalize, assertCanonical, CanonicalizationError } from "../../src/lib/canonicalize";
import { computeHash, verifyRecordHash, buildS3Key, isGenesisRecord } from "../../src/lib/hasher";
import { AuditService, AuditS3WriteError, AuditLockTimeoutError } from "../../src/services/audit.service";
import type { AuditDbPort, AuditS3Port } from "../../src/services/audit.service";
import type { AuditEventPayload, AuditRecord, AuditServiceConfig } from "../../src/types/audit.types";
import { GENESIS_SENTINEL } from "../../src/types/audit.types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-hmac-secret-32-bytes-minimum!!";

const TEST_CONFIG: AuditServiceConfig = {
  hmac_secret: TEST_SECRET,
  s3_bucket: "synthforce-audit-test",
  s3_prefix: "audit-logs/v1",
  s3_region: "us-east-1",
  db_connection_string: "postgresql://test",
  schema_version: "1.0.0",
};

function makePayload(overrides: Partial<AuditEventPayload> = {}): AuditEventPayload {
  return {
    category: "AGENT_LIFECYCLE",
    event_type: "AGENT_LIFECYCLE.ONBOARD",
    actor: {
      type: "AGENT",
      agent_id: "agent-001",
      agent_version: "1.0.0",
      tenant_id: "tenant-abc",
    },
    outcome: "SUCCESS",
    resource_type: "Agent",
    resource_id: "agent-001",
    tenant_id: "tenant-abc",
    timestamp_utc: "2025-01-15T10:30:00.000Z",
    metadata: { reason: "initial_deployment" },
    schema_version: "1.0.0",
    ...overrides,
  };
}

function makeRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
  const payload = makePayload();
  const prevHash = GENESIS_SENTINEL;
  const currentHash = computeHash(payload, prevHash, TEST_SECRET);
  return {
    id: "record-001",
    tenant_id: "tenant-abc",
    prev_hash: prevHash,
    current_hash: currentHash,
    payload,
    s3_key: "audit-logs/v1/tenant-abc/2025/01/15/record-001.json",
    created_at: "2025-01-15T10:30:01.000Z",
    ...overrides,
  };
}

// ─── Mock Factories ───────────────────────────────────────────────────────────

function makeMockDb(overrides: Partial<AuditDbPort> = {}): AuditDbPort {
  return {
    getLatestRecord: vi.fn().mockResolvedValue(null),
    insertRecord: vi.fn().mockResolvedValue(undefined),
    acquireChainLock: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)),
    getRecordsForVerification: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeMockS3(overrides: Partial<AuditS3Port> = {}): AuditS3Port {
  return {
    putRecord: vi.fn().mockResolvedValue(undefined),
    getRecord: vi.fn().mockResolvedValue(makeRecord()),
    ...overrides,
  };
}

// =============================================================================
// CANONICALIZE
// =============================================================================

describe("canonicalize()", () => {
  it("produces identical output regardless of object key insertion order", () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    const c = { m: 3, z: 1, a: 2 };
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(canonicalize(b)).toBe(canonicalize(c));
  });

  it("sorts nested object keys recursively", () => {
    const input = { z: { b: 2, a: 1 }, a: { y: 9, x: 8 } };
    expect(canonicalize(input)).toBe('{"a":{"x":8,"y":9},"z":{"a":1,"b":2}}');
  });

  it("preserves array element order (arrays are NOT sorted)", () => {
    const input = { items: [3, 1, 2] };
    expect(canonicalize(input)).toBe('{"items":[3,1,2]}');
  });

  it("handles null values", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize({ a: null })).toBe('{"a":null}');
  });

  it("handles booleans", () => {
    expect(canonicalize({ flag: true, other: false })).toBe('{"flag":true,"other":false}');
  });

  it("handles deeply nested structures", () => {
    const deep = { a: { b: { c: { d: "leaf" } } } };
    expect(canonicalize(deep)).toBe('{"a":{"b":{"c":{"d":"leaf"}}}}');
  });

  it("throws CanonicalizationError for undefined values", () => {
    expect(() => canonicalize({ a: undefined })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ a: undefined })).toThrow(/undefined value/);
  });

  it("throws CanonicalizationError for NaN", () => {
    expect(() => canonicalize({ a: NaN })).toThrow(CanonicalizationError);
  });

  it("throws CanonicalizationError for Infinity", () => {
    expect(() => canonicalize({ a: Infinity })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ a: -Infinity })).toThrow(CanonicalizationError);
  });

  it("throws CanonicalizationError for -0", () => {
    expect(() => canonicalize({ a: -0 })).toThrow(CanonicalizationError);
  });

  it("throws CanonicalizationError for class instances", () => {
    class Foo { x = 1; }
    expect(() => canonicalize(new Foo())).toThrow(CanonicalizationError);
    expect(() => canonicalize(new Foo())).toThrow(/class instance/);
  });

  it("throws for functions", () => {
    expect(() => canonicalize({ fn: () => {} })).toThrow(CanonicalizationError);
  });

  it("produces no whitespace in output", () => {
    const result = canonicalize({ a: 1, b: { c: 2 } });
    expect(result).not.toMatch(/\s/);
  });

  it("is idempotent — canonicalizing a canonical string round-trips correctly", () => {
    const original = { z: 3, a: 1, m: 2 };
    const first = canonicalize(original);
    const parsed = JSON.parse(first);
    const second = canonicalize(parsed);
    expect(first).toBe(second);
  });
});

describe("assertCanonical()", () => {
  it("passes for already-canonical JSON", () => {
    const canonical = '{"a":1,"z":2}';
    expect(() => assertCanonical(canonical)).not.toThrow();
  });

  it("throws for non-canonical key ordering", () => {
    // JSON.parse loses order, but if we construct a string with wrong order:
    const nonCanonical = '{"z":2,"a":1}';
    expect(() => assertCanonical(nonCanonical)).toThrow(CanonicalizationError);
  });
});

// =============================================================================
// HASHER
// =============================================================================

describe("computeHash()", () => {
  it("produces a 64-character hex string (SHA-256 output)", () => {
    const hash = computeHash(makePayload(), GENESIS_SENTINEL, TEST_SECRET);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same inputs always produce same hash", () => {
    const payload = makePayload();
    const h1 = computeHash(payload, GENESIS_SENTINEL, TEST_SECRET);
    const h2 = computeHash(payload, GENESIS_SENTINEL, TEST_SECRET);
    expect(h1).toBe(h2);
  });

  it("changes hash when payload content changes", () => {
    const h1 = computeHash(makePayload({ outcome: "SUCCESS" }), GENESIS_SENTINEL, TEST_SECRET);
    const h2 = computeHash(makePayload({ outcome: "FAILURE" }), GENESIS_SENTINEL, TEST_SECRET);
    expect(h1).not.toBe(h2);
  });

  it("changes hash when prev_hash changes (chain linkage)", () => {
    const payload = makePayload();
    const h1 = computeHash(payload, GENESIS_SENTINEL, TEST_SECRET);
    const h2 = computeHash(payload, "a".repeat(64), TEST_SECRET);
    expect(h1).not.toBe(h2);
  });

  it("changes hash when HMAC secret changes", () => {
    const payload = makePayload();
    const h1 = computeHash(payload, GENESIS_SENTINEL, "secret-one");
    const h2 = computeHash(payload, GENESIS_SENTINEL, "secret-two");
    expect(h1).not.toBe(h2);
  });

  it("is key-order-invariant — payload with swapped key order produces same hash", () => {
    // Simulate two objects with same data, different insertion order
    const p1 = makePayload({ metadata: { b: 2, a: 1 } });
    const p2 = makePayload({ metadata: { a: 1, b: 2 } });
    const h1 = computeHash(p1, GENESIS_SENTINEL, TEST_SECRET);
    const h2 = computeHash(p2, GENESIS_SENTINEL, TEST_SECRET);
    expect(h1).toBe(h2); // This is the core invariant
  });
});

describe("verifyRecordHash()", () => {
  it("returns true for a correctly hashed record", () => {
    const payload = makePayload();
    const hash = computeHash(payload, GENESIS_SENTINEL, TEST_SECRET);
    expect(verifyRecordHash(payload, GENESIS_SENTINEL, hash, TEST_SECRET)).toBe(true);
  });

  it("returns false if stored hash doesn't match recomputed hash", () => {
    const payload = makePayload();
    const tamperedHash = "0".repeat(64);
    expect(verifyRecordHash(payload, GENESIS_SENTINEL, tamperedHash, TEST_SECRET)).toBe(false);
  });

  it("returns false if payload has been mutated", () => {
    const payload = makePayload();
    const hash = computeHash(payload, GENESIS_SENTINEL, TEST_SECRET);
    const mutated = { ...payload, outcome: "FAILURE" as const };
    expect(verifyRecordHash(mutated, GENESIS_SENTINEL, hash, TEST_SECRET)).toBe(false);
  });
});

describe("isGenesisRecord()", () => {
  it("returns true for GENESIS_SENTINEL", () => {
    expect(isGenesisRecord(GENESIS_SENTINEL)).toBe(true);
  });

  it("returns false for any other hash", () => {
    expect(isGenesisRecord("a".repeat(64))).toBe(false);
  });
});

describe("buildS3Key()", () => {
  it("produces correct path format", () => {
    const key = buildS3Key("audit-logs/v1", "tenant-abc", "rec-001", "2025-06-15T14:30:00.000Z");
    expect(key).toBe("audit-logs/v1/tenant-abc/2025/06/15/rec-001.json");
  });

  it("zero-pads months and days", () => {
    const key = buildS3Key("prefix", "tid", "rid", "2025-01-05T00:00:00.000Z");
    expect(key).toContain("/2025/01/05/");
  });

  it("uses UTC date, not local date", () => {
    // 11pm UTC on Jan 15 must NOT produce Jan 16 in any timezone
    const key = buildS3Key("p", "t", "r", "2025-01-15T23:00:00.000Z");
    expect(key).toContain("/2025/01/15/");
  });
});

// =============================================================================
// AUDIT SERVICE
// =============================================================================

describe("AuditService.emit()", () => {
  let db: AuditDbPort;
  let s3: AuditS3Port;
  let service: AuditService;

  beforeEach(() => {
    db = makeMockDb();
    s3 = makeMockS3();
    service = new AuditService(TEST_CONFIG, db, s3);
  });

  it("returns a valid AuditRecord with correct structure", async () => {
    const payload = makePayload();
    const record = await service.emit(payload);

    expect(record.id).toBeDefined();
    expect(record.tenant_id).toBe(payload.tenant_id);
    expect(record.prev_hash).toBe(GENESIS_SENTINEL); // no prior record
    expect(record.current_hash).toHaveLength(64);
    expect(record.payload).toEqual(payload);
    expect(record.s3_key).toContain(payload.tenant_id);
  });

  it("uses GENESIS_SENTINEL as prev_hash when no prior record exists", async () => {
    vi.mocked(db.getLatestRecord).mockResolvedValue(null);
    const record = await service.emit(makePayload());
    expect(record.prev_hash).toBe(GENESIS_SENTINEL);
  });

  it("uses the latest record's current_hash as prev_hash", async () => {
    const priorHash = "f".repeat(64);
    vi.mocked(db.getLatestRecord).mockResolvedValue({ id: "prior", current_hash: priorHash });
    const record = await service.emit(makePayload());
    expect(record.prev_hash).toBe(priorHash);
  });

  it("writes to S3 BEFORE writing to DB", async () => {
    const callOrder: string[] = [];
    vi.mocked(s3.putRecord).mockImplementation(async () => { callOrder.push("s3"); });
    vi.mocked(db.insertRecord).mockImplementation(async () => { callOrder.push("db"); });

    await service.emit(makePayload());

    expect(callOrder).toEqual(["s3", "db"]);
  });

  it("throws AuditS3WriteError and does NOT write to DB if S3 fails", async () => {
    vi.mocked(s3.putRecord).mockRejectedValue(new Error("S3 unavailable"));

    await expect(service.emit(makePayload())).rejects.toThrow(AuditS3WriteError);
    expect(db.insertRecord).not.toHaveBeenCalled();
  });

  it("acquires and releases the chain lock even on S3 failure", async () => {
    const releaseLock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.acquireChainLock).mockResolvedValue(releaseLock);
    vi.mocked(s3.putRecord).mockRejectedValue(new Error("S3 down"));

    await expect(service.emit(makePayload())).rejects.toThrow();
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it("acquires the lock with tenant_id and 5000ms timeout", async () => {
    await service.emit(makePayload());
    expect(db.acquireChainLock).toHaveBeenCalledWith("tenant-abc", 5000);
  });

  it("produces deterministic, verifiable hashes", async () => {
    const payload = makePayload();
    const record = await service.emit(payload);
    const valid = verifyRecordHash(payload, GENESIS_SENTINEL, record.current_hash, TEST_SECRET);
    expect(valid).toBe(true);
  });
});

describe("AuditService.verifyChain()", () => {
  let db: AuditDbPort;
  let s3: AuditS3Port;
  let service: AuditService;

  beforeEach(() => {
    db = makeMockDb();
    s3 = makeMockS3();
    service = new AuditService(TEST_CONFIG, db, s3);
  });

  it("returns valid: true for an empty chain", async () => {
    vi.mocked(db.getRecordsForVerification).mockResolvedValue([]);
    const result = await service.verifyChain("tenant-abc");
    expect(result.valid).toBe(true);
    expect(result.checked_count).toBe(0);
  });

  it("returns valid: true for a correctly chained sequence", async () => {
    const p1 = makePayload({ event_type: "AGENT_LIFECYCLE.ONBOARD" });
    const h1 = computeHash(p1, GENESIS_SENTINEL, TEST_SECRET);
    const r1: AuditRecord = {
      id: "r1", tenant_id: "tenant-abc",
      prev_hash: GENESIS_SENTINEL, current_hash: h1,
      payload: p1, s3_key: "k1", created_at: "2025-01-15T10:00:00.000Z",
    };

    const p2 = makePayload({ event_type: "AGENT_LIFECYCLE.SUSPEND" });
    const h2 = computeHash(p2, h1, TEST_SECRET);
    const r2: AuditRecord = {
      id: "r2", tenant_id: "tenant-abc",
      prev_hash: h1, current_hash: h2,
      payload: p2, s3_key: "k2", created_at: "2025-01-15T11:00:00.000Z",
    };

    vi.mocked(db.getRecordsForVerification)
      .mockResolvedValueOnce([r1, r2])
      .mockResolvedValueOnce([]);

    const result = await service.verifyChain("tenant-abc");
    expect(result.valid).toBe(true);
    expect(result.checked_count).toBe(2);
  });

  it("detects a tampered payload (hash mismatch)", async () => {
    const payload = makePayload();
    const correctHash = computeHash(payload, GENESIS_SENTINEL, TEST_SECRET);
    const tamperedPayload = { ...payload, outcome: "FAILURE" as const };

    const record: AuditRecord = {
      id: "r1", tenant_id: "tenant-abc",
      prev_hash: GENESIS_SENTINEL,
      current_hash: correctHash, // hash is for original payload, but payload is tampered
      payload: tamperedPayload,
      s3_key: "k1", created_at: "2025-01-15T10:00:00.000Z",
    };

    vi.mocked(db.getRecordsForVerification)
      .mockResolvedValueOnce([record])
      .mockResolvedValueOnce([]);

    const result = await service.verifyChain("tenant-abc");
    expect(result.valid).toBe(false);
    expect(result.first_invalid_id).toBe("r1");
  });

  it("detects a broken prev_hash link (record insertion/deletion)", async () => {
    const p1 = makePayload();
    const h1 = computeHash(p1, GENESIS_SENTINEL, TEST_SECRET);
    const r1: AuditRecord = {
      id: "r1", tenant_id: "tenant-abc",
      prev_hash: GENESIS_SENTINEL, current_hash: h1,
      payload: p1, s3_key: "k1", created_at: "2025-01-15T10:00:00.000Z",
    };

    // r2's prev_hash is wrong — simulates a deleted record between r1 and r2
    const p2 = makePayload();
    const wrongPrevHash = "b".repeat(64);
    const h2 = computeHash(p2, wrongPrevHash, TEST_SECRET);
    const r2: AuditRecord = {
      id: "r2", tenant_id: "tenant-abc",
      prev_hash: wrongPrevHash, // should be h1
      current_hash: h2,
      payload: p2, s3_key: "k2", created_at: "2025-01-15T11:00:00.000Z",
    };

    vi.mocked(db.getRecordsForVerification)
      .mockResolvedValueOnce([r1, r2])
      .mockResolvedValueOnce([]);

    const result = await service.verifyChain("tenant-abc");
    expect(result.valid).toBe(false);
    expect(result.first_invalid_id).toBe("r2");
    expect(result.first_invalid_position).toBe(1);
  });
});

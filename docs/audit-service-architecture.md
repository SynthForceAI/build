# Audit Service — Architectural Review
**Document:** SF-ARCH-005
**Status:** Approved for MVP Implementation
**Reviewer:** Principal Software Architect, Synthforce AI

---

## System Overview

The Audit Service implements a **hybrid immutability model**: hash-chained records stored in Postgres (query cache) with a canonical S3/WORM bucket as the tamper-evident source of truth.

```
                    ┌─────────────────────────────────────────┐
                    │           AuditService.emit()           │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │   1. acquireChainLock(tenantId, 5000ms)  │
                    │      [Postgres advisory lock — per tenant]│
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │   2. getLatestRecord(tenantId)           │
                    │      → prev_hash (or GENESIS_SENTINEL)   │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │   3. computeHash(payload, prevHash, key)  │
                    │      HMAC-SHA256(prevHash|canonical(p))  │
                    └──────────────────┬──────────────────────┘
                                       │
                         ┌─────────────┴──────────────┐
                         │                            │
              ┌──────────▼──────────┐    ┌────────────▼────────────┐
              │  4a. S3 PUT (WORM)  │    │  4b. Postgres INSERT     │
              │  SOURCE OF TRUTH    │    │  QUERY CACHE (RLS)       │
              │  Object Lock on     │    │  Append-only trigger     │
              └─────────────────────┘    └──────────────────────────┘
              MUST SUCCEED FIRST          Only attempted after S3 OK
```

---

## Critical Design Decisions

### 1. Serialization: Canonical JSON (RFC 8785)

**Decision:** All hash inputs are serialized via `canonicalize()` — recursive key sort, no whitespace, UTF-8.

**Rationale:** `JSON.stringify()` key order is insertion-order-dependent in V8. Two payloads with identical data but different construction paths produce different strings and therefore different hashes. This would silently break chain verification after any refactor that restructures object construction.

**Risk Mitigation:** `canonicalize()` throws on any non-serializable value (`undefined`, `NaN`, `-0`, class instances). Bugs surface at write time, not at verification time.

**Cross-language contract:** RFC 8785 compliance means a Python or Go verifier can independently verify the chain without access to the Node.js service.

---

### 2. Hash Input: HMAC over `prevHash|canonical(payload)`

**Decision:** Hash input is `prev_hash + "|" + canonicalize(payload)`, not just `canonicalize(payload)`.

**Why HMAC, not plain SHA-256:**
Plain SHA-256 is unauthenticated. An attacker with read access to S3 can read payloads, recompute hashes, and forge a "valid" chain after tampering. HMAC binds hash validity to a secret key, enabling **non-repudiation**: only Synthforce (or a customer given their tenant key) can verify chain integrity.

**Why `prevHash` in the HMAC input (not just stored as a field):**
Incorporating `prevHash` into the hash computation means the chain cannot be reordered without invalidating all subsequent hashes. If `prevHash` were merely stored as metadata, an attacker could swap two records without breaking their individual hashes.

**Pipe delimiter:** Prevents length-extension ambiguity between the sentinel (64 zeros) and a hash starting with zeros.

---

### 3. Write Order: S3-first, DB-second

**Decision:** S3 write must succeed before DB write is attempted. If S3 fails, throw `AuditS3WriteError` and abort without touching DB.

**Failure modes:**

| Scenario | S3 State | DB State | Recovery |
|---|---|---|---|
| S3 write fails | Not written | Not written | Caller retries. No data loss, no chain corruption. |
| S3 write ok, DB write fails | Written ✓ | Not written | Reconciliation job (SF-ARCH-009) replays S3 → DB. Chain valid. |
| Both succeed | Written ✓ | Written ✓ | Normal path. |

The reconciliation job is **not** part of this MVP but is a hard architectural dependency. It must be implemented before GA.

---

### 4. Concurrency: Per-tenant Advisory Locks

**Decision:** `pg_advisory_xact_lock()` keyed on a deterministic bigint derived from `tenant_id`.

**Rationale:** Without serialization, two concurrent emits for the same tenant can both read the same `prev_hash`, producing two records with the same `prev_hash` — a chain fork. Advisory locks are cheap (no table scan), per-transaction (auto-released on commit/rollback), and tenant-scoped (cross-tenant writes are fully parallel).

**Lock key derivation:** `('x' || substr(tenant_id::text, 1, 16))::bit(64)::bigint` — deterministic, collision-resistant at the tenant population scale Synthforce will operate at in MVP.

**Timeout:** 5000ms. High write contention will surface as `AuditLockTimeoutError`. This is a signal to shard the chain (per-category chains per tenant) — tracked as SF-ARCH-011.

---

### 5. RLS: Zero-Trust Tenant Isolation

**Decision:** Postgres Row-Level Security with `FORCE ROW LEVEL SECURITY` (applies to superusers too). App sets `app.current_tenant_id` per transaction.

**Critical constraint for connection poolers:** PgBouncer must run in **transaction mode**, not session mode. In session mode, `SET app.current_tenant_id` persists across connections in the pool, creating cross-tenant data leakage. This must be validated in infrastructure review before production deployment.

---

## Open Risks & Tracked Items

| ID | Risk | Severity | Status |
|---|---|---|---|
| SF-ARCH-007 | HMAC key rotation requires rehash of historical records | HIGH | Deferred post-MVP |
| SF-ARCH-009 | S3→DB reconciliation job not yet implemented | HIGH | Required before GA |
| SF-ARCH-011 | Advisory lock contention under high write volume | MEDIUM | Monitor, shard if needed |
| SF-ARCH-013 | PgBouncer transaction mode enforcement | HIGH | Infrastructure review required |
| SF-IMPL-003 | Switch record IDs from UUIDv4 to UUIDv7 for index locality | LOW | Pre-GA |

---

## What This Scaffold Does NOT Cover (Next Iterations)

1. **HTTP route layer** — Express/Fastify routes, auth middleware, JWT tenant claim extraction
2. **Concrete DB adapter** — `pg.Pool` implementation of `AuditDbPort`
3. **Concrete S3 adapter** — `@aws-sdk/client-s3` implementation of `AuditS3Port`
4. **S3→DB reconciliation job** — SF-ARCH-009
5. **Compliance report generator** — consumes `audit_records`, emits SOC2 evidence packages
6. **Integration tests** — require real Postgres + LocalStack S3

These are the correct next iterations, in this order.

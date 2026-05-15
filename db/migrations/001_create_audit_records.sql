-- =============================================================================
-- Synthforce Audit Service — Database Schema
-- Migration: 001_create_audit_records
-- =============================================================================
--
-- ARCHITECTURE NOTES:
--   - This table is a QUERY CACHE. S3/WORM is the source of truth.
--   - Row-Level Security (RLS) is enforced at the DB level, not the app level.
--     This is zero-trust: even if the app layer has a bug, cross-tenant
--     data leakage is blocked by Postgres.
--   - The `tenant_id` column is denormalized into every row intentionally.
--     Joins to a tenants table would bypass RLS on the joined table.
--   - Advisory locks for chain serialization use pg_try_advisory_xact_lock()
--     with a deterministic lock key derived from tenant_id.
-- =============================================================================

BEGIN;

-- ─── Extension ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid() fallback

-- ─── Enum Types ───────────────────────────────────────────────────────────────

CREATE TYPE actor_type AS ENUM (
  'AGENT',
  'HUMAN_OPERATOR',
  'EXTERNAL_SYSTEM',
  'PLATFORM'
);

CREATE TYPE event_category AS ENUM (
  'AGENT_LIFECYCLE',
  'DECISION_TRACE',
  'POLICY_ENFORCEMENT',
  'DATA_ACCESS',
  'CONFIGURATION_CHANGE',
  'AUTH_EVENT',
  'INTEGRATION_EVENT',
  'COMPLIANCE_REPORT'
);

CREATE TYPE event_outcome AS ENUM (
  'SUCCESS',
  'FAILURE',
  'PARTIAL',
  'PENDING'
);

-- ─── Core Table ───────────────────────────────────────────────────────────────

CREATE TABLE audit_records (
  -- Identity
  id              UUID          NOT NULL DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,

  -- Chain integrity
  prev_hash       CHAR(64)      NOT NULL, -- HMAC-SHA256 hex, or GENESIS_SENTINEL
  current_hash    CHAR(64)      NOT NULL,

  -- S3 pointer (source of truth location)
  s3_key          TEXT          NOT NULL,

  -- Denormalized query fields (avoid JSON traversal for common filters)
  category        event_category NOT NULL,
  event_type      TEXT          NOT NULL,
  actor_type      actor_type    NOT NULL,
  actor_id        TEXT          NOT NULL, -- agent_id | user_id | system_id | service name
  outcome         event_outcome NOT NULL,
  resource_type   TEXT          NOT NULL,
  resource_id     TEXT          NOT NULL,
  schema_version  TEXT          NOT NULL,

  -- Full payload (canonical JSON — DO NOT mutate post-insert)
  payload         JSONB         NOT NULL,

  -- Timestamps
  event_time      TIMESTAMPTZ   NOT NULL, -- from payload.timestamp_utc
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT audit_records_pkey PRIMARY KEY (id),
  CONSTRAINT audit_records_hash_length CHECK (char_length(current_hash) = 64),
  CONSTRAINT audit_records_prev_hash_length CHECK (char_length(prev_hash) = 64),
  CONSTRAINT audit_records_s3_key_nonempty CHECK (s3_key <> ''),
  CONSTRAINT audit_records_no_future_events CHECK (event_time <= created_at + INTERVAL '5 minutes')
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Primary query patterns:
-- 1. Chain verification: tenant + created_at ASC (sequential scan of chain)
-- 2. Compliance report: tenant + category + event_time range
-- 3. Actor investigation: tenant + actor_id + event_time range
-- 4. Resource audit: tenant + resource_type + resource_id

CREATE INDEX idx_audit_tenant_created
  ON audit_records (tenant_id, created_at ASC);

CREATE INDEX idx_audit_tenant_category_time
  ON audit_records (tenant_id, category, event_time DESC);

CREATE INDEX idx_audit_tenant_actor
  ON audit_records (tenant_id, actor_id, event_time DESC);

CREATE INDEX idx_audit_tenant_resource
  ON audit_records (tenant_id, resource_type, resource_id, event_time DESC);

CREATE INDEX idx_audit_tenant_outcome
  ON audit_records (tenant_id, outcome, event_time DESC)
  WHERE outcome = 'FAILURE'; -- partial index — failure queries are compliance-critical

-- Hash lookup (for chain verification spot-checks)
CREATE UNIQUE INDEX idx_audit_current_hash
  ON audit_records (current_hash);

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE audit_records ENABLE ROW LEVEL SECURITY;

-- Force RLS even for superusers in this table (belt + suspenders)
ALTER TABLE audit_records FORCE ROW LEVEL SECURITY;

-- Policy: app role can only see rows where tenant_id matches JWT claim
-- The app sets `app.current_tenant_id` at the start of each transaction.
-- Connection poolers (PgBouncer) must use transaction mode, not session mode.

CREATE POLICY audit_tenant_isolation ON audit_records
  FOR ALL
  TO synthforce_app_role
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Read-only policy for the compliance reporter role
CREATE POLICY audit_compliance_read ON audit_records
  FOR SELECT
  TO synthforce_compliance_role
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ─── Revoke Direct Access ─────────────────────────────────────────────────────

-- Nobody gets direct table access except through defined roles
REVOKE ALL ON audit_records FROM PUBLIC;
GRANT SELECT, INSERT ON audit_records TO synthforce_app_role;
GRANT SELECT ON audit_records TO synthforce_compliance_role;
-- NOTE: No UPDATE, No DELETE for any role. Chain is append-only.

-- ─── Advisory Lock Helper Function ───────────────────────────────────────────

-- Derives a stable bigint lock key from tenant_id UUID.
-- Used by the app layer to serialize chain writes per tenant.
CREATE OR REPLACE FUNCTION audit_chain_lock_key(p_tenant_id UUID)
RETURNS BIGINT
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT ('x' || substr(p_tenant_id::text, 1, 16))::bit(64)::bigint;
$$;

COMMENT ON FUNCTION audit_chain_lock_key IS
  'Derives a deterministic advisory lock key from a tenant UUID for chain-write serialization.';

-- ─── Immutability Trigger ─────────────────────────────────────────────────────

-- Belt + suspenders: even if app role somehow gets UPDATE, block it at DB level.
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_records is append-only. UPDATE and DELETE are prohibited. (tenant_id: %, record_id: %)',
    OLD.tenant_id, OLD.id
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_immutability_guard
  BEFORE UPDATE OR DELETE ON audit_records
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

COMMIT;

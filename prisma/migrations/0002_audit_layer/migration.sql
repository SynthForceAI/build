-- SynthForce — audit layer (wedge product)
-- Adds the Free Agent Audit tables on top of the platform schema (0001).

-- ============================================================================
-- ApiKey: add deleted_at for the audit's soft-delete-after-completion flow
-- ============================================================================

ALTER TABLE "api_keys"
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE "audit_status"     AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE "finding_type"     AS ENUM (
  'model_optimization', 'idle_cost', 'cost_spike',
  'provider_comparison', 'benchmark', 'spend_trend', 'underuse'
);
CREATE TYPE "finding_severity" AS ENUM ('info', 'low', 'medium', 'high', 'critical');

-- ============================================================================
-- audits
-- ============================================================================

CREATE TABLE "audits" (
    "id"                        UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"                UUID           NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "initiated_by"              UUID           NOT NULL REFERENCES "users"("id")     ON DELETE CASCADE,
    "api_key_id"                UUID           REFERENCES "api_keys"("id")           ON DELETE SET NULL,
    "status"                    audit_status   NOT NULL DEFAULT 'pending',
    "data_period_start"         TIMESTAMPTZ(6),
    "data_period_end"           TIMESTAMPTZ(6),
    "total_monthly_spend_cents" BIGINT,
    "estimated_waste_cents"     BIGINT,
    "efficiency_score"          NUMERIC(5, 2),
    "total_api_calls"           INTEGER,
    "total_tokens_in"           BIGINT,
    "total_tokens_out"          BIGINT,
    "report_data"               JSONB,
    "report_summary"            TEXT,
    "error_message"             TEXT,
    "created_at"                TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "started_at"                TIMESTAMPTZ(6),
    "completed_at"              TIMESTAMPTZ(6)
);

CREATE INDEX "audits_company_created_idx" ON "audits"("company_id", "created_at" DESC);
CREATE INDEX "audits_status_created_idx"  ON "audits"("status", "created_at");

-- ============================================================================
-- audit_findings
-- ============================================================================

CREATE TABLE "audit_findings" (
    "id"                      UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    "audit_id"                UUID             NOT NULL REFERENCES "audits"("id") ON DELETE CASCADE,
    "type"                    finding_type     NOT NULL,
    "severity"                finding_severity NOT NULL DEFAULT 'info',
    "title"                   VARCHAR(255)     NOT NULL,
    "description"             TEXT             NOT NULL,
    "potential_savings_cents" BIGINT,
    "metadata"                JSONB            NOT NULL DEFAULT '{}',
    "order_hint"              INTEGER          NOT NULL DEFAULT 0
);

CREATE INDEX "audit_findings_audit_idx" ON "audit_findings"("audit_id");

-- ============================================================================
-- discovered_agents — inferred buckets from aggregate billing data
-- ============================================================================

CREATE TABLE "discovered_agents" (
    "id"                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "audit_id"          UUID         NOT NULL REFERENCES "audits"("id") ON DELETE CASCADE,
    "name"              VARCHAR(255) NOT NULL,
    "model"             VARCHAR(255) NOT NULL,
    "provider_name"     VARCHAR(100) NOT NULL,
    "tasks_completed"   INTEGER      NOT NULL DEFAULT 0,
    "total_cost_cents"  BIGINT       NOT NULL DEFAULT 0,
    "total_tokens_in"   BIGINT       NOT NULL DEFAULT 0,
    "total_tokens_out"  BIGINT       NOT NULL DEFAULT 0,
    "efficiency_rating" VARCHAR(20)  NOT NULL DEFAULT 'unknown',
    "details"           JSONB        NOT NULL DEFAULT '{}'
);

CREATE INDEX "discovered_agents_audit_idx" ON "discovered_agents"("audit_id");

-- ============================================================================
-- audit_raw_logs — raw provider responses, for debugging + reproducibility
-- ============================================================================

CREATE TABLE "audit_raw_logs" (
    "id"           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "audit_id"     UUID           NOT NULL REFERENCES "audits"("id") ON DELETE CASCADE,
    "source"       VARCHAR(100)   NOT NULL,
    "raw_response" JSONB          NOT NULL,
    "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "audit_raw_logs_audit_idx" ON "audit_raw_logs"("audit_id");

-- ============================================================================
-- RLS for audit tables
-- ============================================================================

ALTER TABLE "audits"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_findings"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discovered_agents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_raw_logs"    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audits_company_select" ON "audits"
  FOR SELECT TO authenticated USING (company_id = current_company_id());

-- Children inherit via parent audit's company.
CREATE POLICY "audit_findings_via_audit" ON "audit_findings"
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "audits" a WHERE a.id = audit_id AND a.company_id = current_company_id()));

CREATE POLICY "discovered_agents_via_audit" ON "discovered_agents"
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM "audits" a WHERE a.id = audit_id AND a.company_id = current_company_id()));

-- audit_raw_logs intentionally has NO authenticated select policy — raw
-- provider responses can contain sensitive billing metadata. Only the
-- service role (server-side handlers) reads them.

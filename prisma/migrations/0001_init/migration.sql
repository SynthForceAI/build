-- SynthForce — initial schema migration
-- Generated from prisma/schema.prisma. Apply with `prisma migrate deploy`.

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE "subscription_tier" AS ENUM ('free', 'starter', 'team', 'enterprise');
CREATE TYPE "user_role"         AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE "agent_status"      AS ENUM ('active', 'paused', 'deactivated', 'flagged');
CREATE TYPE "policy_severity"   AS ENUM ('warning', 'block', 'flag', 'log');
CREATE TYPE "policy_scope"      AS ENUM ('global', 'department', 'agent');
CREATE TYPE "budget_alert_type" AS ENUM ('budget_80pct', 'budget_100pct', 'budget_exceeded', 'anomaly');

-- ============================================================================
-- Companies (tenants)
-- ============================================================================

CREATE TABLE "companies" (
    "id"                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"              VARCHAR(255)      NOT NULL,
    "slug"              VARCHAR(100)      NOT NULL UNIQUE,
    "subscription_tier" subscription_tier NOT NULL DEFAULT 'free',
    "settings"          JSONB             NOT NULL DEFAULT '{}',
    "is_active"         BOOLEAN           NOT NULL DEFAULT TRUE,
    "created_at"        TIMESTAMPTZ(6)    NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ(6)    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Users (mirrors auth.users.id from Supabase Auth)
-- ============================================================================

CREATE TABLE "users" (
    "id"            UUID           PRIMARY KEY,
    "company_id"    UUID           NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "email"         VARCHAR(255)   NOT NULL,
    "name"          VARCHAR(255)   NOT NULL,
    "role"          user_role      NOT NULL DEFAULT 'member',
    "avatar_url"    VARCHAR(500),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    UNIQUE ("company_id", "email")
);

CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- ============================================================================
-- Departments
-- ============================================================================

CREATE TABLE "departments" (
    "id"                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"           UUID           NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "name"                 VARCHAR(255)   NOT NULL,
    "description"          TEXT,
    "monthly_budget_cents" BIGINT         NOT NULL DEFAULT 0,
    "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    UNIQUE ("company_id", "name")
);

CREATE INDEX "departments_company_id_idx" ON "departments"("company_id");

-- ============================================================================
-- Providers + provider_models (seeded; see prisma/seed.ts)
-- ============================================================================

CREATE TABLE "providers" (
    "id"           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"         VARCHAR(100)   NOT NULL UNIQUE,
    "display_name" VARCHAR(255)   NOT NULL,
    "api_base_url" VARCHAR(500),
    "is_active"    BOOLEAN        NOT NULL DEFAULT TRUE,
    "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE "provider_models" (
    "id"                     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    "provider_id"            UUID            NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
    "model_id"               VARCHAR(255)    NOT NULL,
    "display_name"           VARCHAR(255)    NOT NULL,
    "input_price_per_token"  NUMERIC(20, 10) NOT NULL DEFAULT 0,
    "output_price_per_token" NUMERIC(20, 10) NOT NULL DEFAULT 0,
    "context_window"         INTEGER         NOT NULL DEFAULT 128000,
    "is_active"              BOOLEAN         NOT NULL DEFAULT TRUE,
    "created_at"             TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW(),
    UNIQUE ("provider_id", "model_id")
);

-- ============================================================================
-- API keys (encrypted at rest)
-- ============================================================================

CREATE TABLE "api_keys" (
    "id"             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"     UUID           NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "provider_id"    UUID           NOT NULL REFERENCES "providers"("id"),
    "label"          VARCHAR(255),
    "encrypted_key"  TEXT           NOT NULL,
    "key_identifier" VARCHAR(100),
    "is_active"      BOOLEAN        NOT NULL DEFAULT TRUE,
    "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    UNIQUE ("company_id", "provider_id", "label")
);

CREATE INDEX "api_keys_company_id_idx" ON "api_keys"("company_id");

-- ============================================================================
-- Agents — core domain entity
-- ============================================================================

CREATE TABLE "agents" (
    "id"                         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"                 UUID           NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "department_id"              UUID           REFERENCES "departments"("id") ON DELETE SET NULL,
    "name"                       VARCHAR(255)   NOT NULL,
    "description"                TEXT,
    "status"                     agent_status   NOT NULL DEFAULT 'active',
    "provider_id"                UUID           REFERENCES "providers"("id"),
    "model_id"                   UUID           REFERENCES "provider_models"("id"),
    "api_key_id"                 UUID           REFERENCES "api_keys"("id"),
    "monthly_budget_cents"       BIGINT         NOT NULL DEFAULT 50000,
    "current_month_spend_cents"  BIGINT         NOT NULL DEFAULT 0,
    "total_lifetime_spend_cents" BIGINT         NOT NULL DEFAULT 0,
    "total_tokens_in"            BIGINT         NOT NULL DEFAULT 0,
    "total_tokens_out"           BIGINT         NOT NULL DEFAULT 0,
    "log_full_content"           BOOLEAN        NOT NULL DEFAULT FALSE,
    "managed_by"                 UUID           REFERENCES "users"("id") ON DELETE SET NULL,
    "metadata"                   JSONB          NOT NULL DEFAULT '{}',
    "last_active_at"             TIMESTAMPTZ(6),
    "created_at"                 TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at"                 TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "agents_company_id_idx"    ON "agents"("company_id");
CREATE INDEX "agents_department_id_idx" ON "agents"("department_id");
CREATE INDEX "agents_status_idx"        ON "agents"("status");
CREATE INDEX "agents_provider_id_idx"   ON "agents"("provider_id");

-- ============================================================================
-- Policies + assignments
-- ============================================================================

CREATE TABLE "policies" (
    "id"                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"          UUID            NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "name"                VARCHAR(255)    NOT NULL,
    "description"         TEXT,
    "rule_definition"     JSONB           NOT NULL,
    "severity"            policy_severity NOT NULL DEFAULT 'warning',
    "scope"               policy_scope    NOT NULL DEFAULT 'global',
    "scope_department_id" UUID            REFERENCES "departments"("id") ON DELETE CASCADE,
    "is_active"           BOOLEAN         NOT NULL DEFAULT TRUE,
    "created_by"          UUID            REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at"          TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW(),
    "updated_at"          TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW(),
    UNIQUE ("company_id", "name")
);

CREATE INDEX "policies_company_id_idx" ON "policies"("company_id");

CREATE TABLE "policy_assignments" (
    "id"          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "policy_id"   UUID           NOT NULL REFERENCES "policies"("id") ON DELETE CASCADE,
    "agent_id"    UUID           NOT NULL REFERENCES "agents"("id")   ON DELETE CASCADE,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    UNIQUE ("policy_id", "agent_id")
);

-- ============================================================================
-- Usage logs (high write volume — consider monthly partitioning at scale)
-- ============================================================================

CREATE TABLE "usage_logs" (
    "id"            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"    UUID            NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "agent_id"      UUID            NOT NULL REFERENCES "agents"("id")    ON DELETE CASCADE,
    "provider_id"   UUID            NOT NULL REFERENCES "providers"("id"),
    "model_id"      UUID            REFERENCES "provider_models"("id"),
    "prompt_text"   TEXT,
    "response_text" TEXT,
    "tokens_in"     INTEGER         NOT NULL DEFAULT 0,
    "tokens_out"    INTEGER         NOT NULL DEFAULT 0,
    "cost_cents"    NUMERIC(20, 6)  NOT NULL DEFAULT 0,
    "duration_ms"   INTEGER,
    "endpoint"      VARCHAR(255),
    "status_code"   INTEGER,
    "was_blocked"   BOOLEAN         NOT NULL DEFAULT FALSE,
    "policy_id"     UUID            REFERENCES "policies"("id"),
    "metadata"      JSONB           NOT NULL DEFAULT '{}',
    "created_at"    TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW()
);

CREATE INDEX "usage_logs_company_id_idx"           ON "usage_logs"("company_id");
CREATE INDEX "usage_logs_agent_id_idx"             ON "usage_logs"("agent_id");
CREATE INDEX "usage_logs_created_at_idx"           ON "usage_logs"("created_at" DESC);
CREATE INDEX "usage_logs_company_created_idx"      ON "usage_logs"("company_id", "created_at" DESC);

-- ============================================================================
-- Budget alerts
-- ============================================================================

CREATE TABLE "budget_alerts" (
    "id"                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    "company_id"          UUID              NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "agent_id"            UUID              REFERENCES "agents"("id")       ON DELETE CASCADE,
    "department_id"       UUID              REFERENCES "departments"("id")  ON DELETE CASCADE,
    "alert_type"          budget_alert_type NOT NULL,
    "threshold_cents"     BIGINT            NOT NULL,
    "current_spend_cents" BIGINT            NOT NULL,
    "message"             TEXT,
    "acknowledged"        BOOLEAN           NOT NULL DEFAULT FALSE,
    "acknowledged_by"     UUID              REFERENCES "users"("id"),
    "created_at"          TIMESTAMPTZ(6)    NOT NULL DEFAULT NOW()
);

CREATE INDEX "budget_alerts_company_created_idx" ON "budget_alerts"("company_id", "created_at" DESC);

-- ============================================================================
-- Row-Level Security (RLS)
-- ----------------------------------------------------------------------------
-- We enable RLS on every multi-tenant table. The application uses the
-- service-role key for trusted server-side writes; anon/authenticated
-- requests (e.g. Supabase JS client from the browser) are gated by these
-- policies via auth.uid().
-- ============================================================================

CREATE OR REPLACE FUNCTION current_company_id() RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
    SELECT company_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

ALTER TABLE "companies"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agents"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policies"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_logs"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_alerts"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys"           ENABLE ROW LEVEL SECURITY;

-- providers + provider_models are global reference data: readable by all
-- authenticated users, writable only by service role.
ALTER TABLE "providers"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_models" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "providers_read_all"        ON "providers"       FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "provider_models_read_all"  ON "provider_models" FOR SELECT TO authenticated USING (TRUE);

-- Company isolation: every multi-tenant table restricts to current company.
CREATE POLICY "companies_self_select"   ON "companies"   FOR SELECT TO authenticated USING (id           = current_company_id());
CREATE POLICY "users_company_select"    ON "users"       FOR SELECT TO authenticated USING (company_id   = current_company_id());
CREATE POLICY "depts_company_select"    ON "departments" FOR SELECT TO authenticated USING (company_id   = current_company_id());
CREATE POLICY "agents_company_select"   ON "agents"      FOR SELECT TO authenticated USING (company_id   = current_company_id());
CREATE POLICY "policies_company_select" ON "policies"    FOR SELECT TO authenticated USING (company_id   = current_company_id());
CREATE POLICY "usage_company_select"    ON "usage_logs"  FOR SELECT TO authenticated USING (company_id   = current_company_id());
CREATE POLICY "alerts_company_select"   ON "budget_alerts" FOR SELECT TO authenticated USING (company_id = current_company_id());

-- API keys: even reads are restricted; the application never returns
-- encrypted_key over the wire anyway, but we belt-and-suspenders it.
CREATE POLICY "api_keys_company_select" ON "api_keys" FOR SELECT TO authenticated USING (company_id = current_company_id());

-- Writes from the browser are intentionally NOT permitted by RLS.
-- All mutations flow through the Next.js API routes using the service
-- role key (server-side only), which bypasses RLS by design.

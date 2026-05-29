-- Multi-provider agent usage tracking.
-- Adds usage/spend counters + a self-report token to connected_agents,
-- a per-event usage table for connected agents, and org-level admin keys
-- used by the provider polling job.

-- ---------------------------------------------------------------------------
-- connected_agents: provider link, report token, spend/usage counters
-- ---------------------------------------------------------------------------
ALTER TABLE "connected_agents" ADD COLUMN "provider_id"             UUID;
ALTER TABLE "connected_agents" ADD COLUMN "report_token_hash"       VARCHAR(64);
ALTER TABLE "connected_agents" ADD COLUMN "total_cost_cents"        BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "connected_agents" ADD COLUMN "monthly_spend_cents"     BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "connected_agents" ADD COLUMN "total_tokens_in"         BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "connected_agents" ADD COLUMN "total_tokens_out"        BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "connected_agents" ADD COLUMN "metadata"                JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "connected_agents" ADD COLUMN "last_usage_reported_at"  TIMESTAMPTZ(6);
ALTER TABLE "connected_agents" ADD COLUMN "last_synced_at"          TIMESTAMPTZ(6);
ALTER TABLE "connected_agents" ADD COLUMN "last_active_at"          TIMESTAMPTZ(6);

CREATE INDEX "connected_agents_provider_id_idx" ON "connected_agents"("provider_id");

ALTER TABLE "connected_agents"
  ADD CONSTRAINT "connected_agents_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- usage_source enum
-- ---------------------------------------------------------------------------
CREATE TYPE "usage_source" AS ENUM ('self_report', 'provider_sync');

-- ---------------------------------------------------------------------------
-- connected_agent_usage_logs
-- ---------------------------------------------------------------------------
CREATE TABLE "connected_agent_usage_logs" (
  "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id"         UUID NOT NULL,
  "connected_agent_id" UUID NOT NULL,
  "provider_id"        UUID,
  "source"             "usage_source" NOT NULL DEFAULT 'self_report',
  "tokens_in"          INTEGER NOT NULL DEFAULT 0,
  "tokens_out"         INTEGER NOT NULL DEFAULT 0,
  "cost_cents"         DECIMAL(20,6) NOT NULL DEFAULT 0,
  "model"              VARCHAR(255),
  "provider_api_id"    VARCHAR(255),
  "duration_ms"        INTEGER,
  "endpoint"           VARCHAR(255),
  "status_code"        INTEGER,
  "metadata"           JSONB NOT NULL DEFAULT '{}',
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "connected_agent_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cau_logs_agent_provider_api_id_key"
  ON "connected_agent_usage_logs"("connected_agent_id", "provider_api_id");
CREATE INDEX "connected_agent_usage_logs_company_id_idx"
  ON "connected_agent_usage_logs"("company_id");
CREATE INDEX "connected_agent_usage_logs_connected_agent_id_idx"
  ON "connected_agent_usage_logs"("connected_agent_id");
CREATE INDEX "connected_agent_usage_logs_created_at_idx"
  ON "connected_agent_usage_logs"("created_at" DESC);

ALTER TABLE "connected_agent_usage_logs"
  ADD CONSTRAINT "connected_agent_usage_logs_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connected_agent_usage_logs"
  ADD CONSTRAINT "connected_agent_usage_logs_connected_agent_id_fkey"
  FOREIGN KEY ("connected_agent_id") REFERENCES "connected_agents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connected_agent_usage_logs"
  ADD CONSTRAINT "connected_agent_usage_logs_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- provider_admin_keys
-- ---------------------------------------------------------------------------
CREATE TABLE "provider_admin_keys" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID NOT NULL,
  "provider_id"    UUID NOT NULL,
  "encrypted_key"  TEXT NOT NULL,
  "metadata"       JSONB NOT NULL DEFAULT '{}',
  "last_synced_at" TIMESTAMPTZ(6),
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "provider_admin_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_admin_keys_company_id_provider_id_key"
  ON "provider_admin_keys"("company_id", "provider_id");
CREATE INDEX "provider_admin_keys_company_id_idx"
  ON "provider_admin_keys"("company_id");

ALTER TABLE "provider_admin_keys"
  ADD CONSTRAINT "provider_admin_keys_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_admin_keys"
  ADD CONSTRAINT "provider_admin_keys_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Add verifiedAt and availableModels to api_keys
ALTER TABLE "api_keys" ADD COLUMN "verified_at" TIMESTAMPTZ(6);
ALTER TABLE "api_keys" ADD COLUMN "available_models" JSONB;

-- Create ConnectedAgentStatus enum
CREATE TYPE "connected_agent_status" AS ENUM ('pending', 'active', 'inactive');

-- Create connected_agents table
CREATE TABLE "connected_agents" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID NOT NULL,
  "api_key_id"     UUID NOT NULL,
  "department_id"  UUID,
  "name"           VARCHAR(255) NOT NULL,
  "provider_name"  VARCHAR(100) NOT NULL,
  "model_used"     VARCHAR(255) NOT NULL DEFAULT '',
  "status"         "connected_agent_status" NOT NULL DEFAULT 'pending',
  "tasks_monitored" INTEGER NOT NULL DEFAULT 0,
  "connected_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"     TIMESTAMPTZ(6),

  CONSTRAINT "connected_agents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "connected_agents_company_id_idx" ON "connected_agents"("company_id");
CREATE INDEX "connected_agents_api_key_id_idx" ON "connected_agents"("api_key_id");

ALTER TABLE "connected_agents"
  ADD CONSTRAINT "connected_agents_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connected_agents"
  ADD CONSTRAINT "connected_agents_api_key_id_fkey"
  FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connected_agents"
  ADD CONSTRAINT "connected_agents_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

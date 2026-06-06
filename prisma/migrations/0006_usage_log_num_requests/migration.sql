-- Add num_requests to connected_agent_usage_logs so the dashboard can
-- display the real provider-reported request count instead of counting rows.
ALTER TABLE "connected_agent_usage_logs"
  ADD COLUMN "num_requests" INTEGER NOT NULL DEFAULT 0;

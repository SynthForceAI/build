/**
 * Google Vertex AI / Gemini usage polling — NOT YET IMPLEMENTED.
 *
 * Unlike OpenAI/Anthropic, Google exposes no first-party usage REST endpoint.
 * Cost/usage comes from Cloud Billing exported to BigQuery (24h lag) and/or
 * Cloud Logging request-response sinks (near real-time). Wiring this requires:
 *   - a GCP service account with billing.viewer + bigquery.dataViewer (+ logging.viewer)
 *   - the @google-cloud/bigquery client (not currently a dependency)
 *   - the customer's BigQuery billing-export dataset/table id (store in
 *     ProviderAdminKey.metadata as { projectId, billingExportTable })
 *
 * Until then, Gemini/Vertex agents should use self-report
 * (POST /api/connected-agents/[id]/report-usage). This function returns a non-fatal
 * result so the polling job skips it without erroring.
 */
import type { ProviderAdminKey } from "@prisma/client";
import type { SyncResult } from "./usage-sync";

export async function syncVertexUsage(_companyId: string, _adminKey: ProviderAdminKey): Promise<SyncResult> {
  return {
    success: false,
    provider: "vertex",
    logsCreated: 0,
    agentsActivated: 0,
    note: "Vertex/Gemini polling is not implemented (requires GCP BigQuery billing export). Use agent self-report.",
  };
}

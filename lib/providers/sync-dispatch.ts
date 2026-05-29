/**
 * Maps a Provider.name to its usage-sync implementation. Shared by the
 * on-demand endpoint (/api/providers/[providerId]/sync-usage) and the
 * scheduled job (lib/jobs/sync-provider-usage.ts).
 */
import type { ProviderAdminKey } from "@prisma/client";
import { syncOpenAIUsage } from "./openai-usage";
import { syncAnthropicUsage } from "./anthropic-usage";
import { syncDeepSeekBalance } from "./deepseek-usage";
import { syncVertexUsage } from "./vertex-usage";
import type { SyncResult } from "./usage-sync";

export async function syncProviderUsage(
  providerName: string,
  companyId: string,
  adminKey: ProviderAdminKey,
): Promise<SyncResult> {
  switch (providerName) {
    case "openai":
      return syncOpenAIUsage(companyId, adminKey);
    case "anthropic":
      return syncAnthropicUsage(companyId, adminKey);
    case "deepseek":
      return syncDeepSeekBalance(companyId, adminKey);
    case "vertex":
    case "google-gemini":
      return syncVertexUsage(companyId, adminKey);
    default:
      return {
        success: false,
        provider: providerName,
        logsCreated: 0,
        agentsActivated: 0,
        note: `Provider "${providerName}" does not support usage sync.`,
      };
  }
}

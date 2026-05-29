/**
 * Scheduled fan-out: poll every configured provider admin key and sync usage.
 * Partial-failure tolerant — one provider/company failing does not abort the
 * rest. Invoked by /api/jobs/sync-provider-usage (Vercel Cron).
 */
import { prisma } from "@/lib/db";
import { syncProviderUsage } from "@/lib/providers/sync-dispatch";
import type { SyncResult } from "@/lib/providers/usage-sync";

export type JobSummary = {
  ranAt: string;
  adminKeysProcessed: number;
  logsCreated: number;
  agentsActivated: number;
  failures: Array<{ companyId: string; provider: string; error: string }>;
  results: SyncResult[];
};

export async function syncAllProviderUsage(): Promise<JobSummary> {
  const adminKeys = await prisma.providerAdminKey.findMany({
    include: { provider: { select: { name: true } } },
  });

  const summary: JobSummary = {
    ranAt: new Date().toISOString(),
    adminKeysProcessed: adminKeys.length,
    logsCreated: 0,
    agentsActivated: 0,
    failures: [],
    results: [],
  };

  for (const adminKey of adminKeys) {
    const providerName = adminKey.provider.name;
    try {
      const result = await syncProviderUsage(providerName, adminKey.companyId, adminKey);
      summary.results.push(result);
      summary.logsCreated += result.logsCreated;
      summary.agentsActivated += result.agentsActivated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failures.push({ companyId: adminKey.companyId, provider: providerName, error: message });
      // eslint-disable-next-line no-console
      console.error(`[sync-provider-usage] ${providerName} / ${adminKey.companyId} failed:`, message);
    }
  }

  return summary;
}

/**
 * DeepSeek has no usage history API — only GET /user/balance (current balance).
 * Primary usage tracking for DeepSeek is agent self-report
 * (POST /api/connected-agents/[id]/report-usage). This balance poll is a reconciliation
 * aid only: we record the latest balance in the admin key's metadata and
 * surface the delta since the previous poll. It creates no usage logs.
 */
import type { ProviderAdminKey } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptApiKey } from "@/lib/crypto";
import type { SyncResult } from "./usage-sync";

const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";

type DeepSeekBalanceResponse = {
  is_available?: boolean;
  balance_infos?: Array<{ currency?: string; total_balance?: string }>;
};

export async function syncDeepSeekBalance(companyId: string, adminKey: ProviderAdminKey): Promise<SyncResult> {
  const key = decryptApiKey(adminKey.encryptedKey);

  const res = await fetch(DEEPSEEK_BALANCE_URL, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (res.status === 401) throw new Error("DeepSeek rejected the key (401).");
  if (!res.ok) throw new Error(`DeepSeek balance endpoint returned ${res.status}.`);

  const json = (await res.json()) as DeepSeekBalanceResponse;
  const info = json.balance_infos?.[0];
  const currentBalance = info?.total_balance ? Number(info.total_balance) : null;

  const meta = (adminKey.metadata ?? {}) as Record<string, unknown>;
  const previousBalance = typeof meta.lastBalance === "number" ? meta.lastBalance : null;
  const delta = currentBalance !== null && previousBalance !== null ? previousBalance - currentBalance : null;

  await prisma.providerAdminKey.update({
    where: { id: adminKey.id },
    data: {
      lastSyncedAt: new Date(),
      metadata: { ...meta, lastBalance: currentBalance, lastCurrency: info?.currency ?? null },
    },
  });

  const note =
    delta !== null
      ? `Balance poll only. Spent ~${delta.toFixed(2)} ${info?.currency ?? ""} since last poll. Use agent self-report for per-agent usage.`
      : "Balance poll only — no prior balance to compare. Use agent self-report for per-agent usage.";

  return { success: true, provider: "deepseek", logsCreated: 0, agentsActivated: 0, note };
}

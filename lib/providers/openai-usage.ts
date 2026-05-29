/**
 * OpenAI org-level usage polling.
 *
 * Uses the Usage API (GET /v1/organization/usage/completions) with an admin
 * key (sk-admin-…). Buckets are grouped by project + model; we estimate cost
 * from token counts via lib/providers/pricing.ts (the usage endpoint returns
 * tokens, not cost — the separate /costs endpoint is daily-aggregated and not
 * mapped per-bucket here).
 */
import type { ProviderAdminKey } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptApiKey } from "@/lib/crypto";
import { persistBuckets, type NormalizedBucket, type SyncResult } from "./usage-sync";

const OPENAI_USAGE_URL = "https://api.openai.com/v1/organization/usage/completions";

type OpenAIUsageResult = {
  input_tokens?: number;
  output_tokens?: number;
  num_model_requests?: number;
  project_id?: string | null;
  api_key_id?: string | null;
  model?: string | null;
};

type OpenAIUsageBucket = {
  start_time?: number;
  end_time?: number;
  results?: OpenAIUsageResult[];
};

type OpenAIUsageResponse = {
  data?: OpenAIUsageBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

export async function syncOpenAIUsage(companyId: string, adminKey: ProviderAdminKey): Promise<SyncResult> {
  const key = decryptApiKey(adminKey.encryptedKey);

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const url = new URL(OPENAI_USAGE_URL);
  url.searchParams.set("start_time", String(Math.floor(oneHourAgo.getTime() / 1000)));
  url.searchParams.set("end_time", String(Math.floor(now.getTime() / 1000)));
  url.searchParams.set("bucket_width", "1m");
  url.searchParams.append("group_by", "project_id");
  url.searchParams.append("group_by", "model");
  url.searchParams.set("limit", "60");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (res.status === 401) throw new Error("OpenAI rejected the admin key (401). Use an sk-admin- key with usage read access.");
  if (res.status === 429) throw new Error("OpenAI rate-limited the usage request (429).");
  if (!res.ok) throw new Error(`OpenAI usage endpoint returned ${res.status}.`);

  const json = (await res.json()) as OpenAIUsageResponse;

  const buckets: NormalizedBucket[] = [];
  for (const bucket of json.data ?? []) {
    for (const r of bucket.results ?? []) {
      const tokensIn = r.input_tokens ?? 0;
      const tokensOut = r.output_tokens ?? 0;
      if (tokensIn === 0 && tokensOut === 0) continue;
      const attributionKey = r.project_id ?? r.api_key_id ?? null;
      buckets.push({
        providerApiId: `${bucket.start_time ?? 0}:${attributionKey ?? ""}:${r.model ?? ""}`,
        tokensIn,
        tokensOut,
        model: r.model ?? null,
        attributionKey,
        metadata: { startTime: bucket.start_time, projectId: r.project_id, apiKeyId: r.api_key_id, numRequests: r.num_model_requests },
      });
    }
  }

  const result = await persistBuckets(companyId, adminKey.providerId, "openai", buckets);
  await prisma.providerAdminKey.update({ where: { id: adminKey.id }, data: { lastSyncedAt: now } });
  return result;
}

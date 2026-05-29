/**
 * Anthropic org-level usage polling.
 *
 * Uses the Usage & Cost Admin API (GET /v1/organizations/usage_report/messages)
 * with an admin key (sk-ant-admin-…). Grouped by api_key + model. Cost is
 * estimated from tokens via lib/providers/pricing.ts. Documented polling limit
 * is once per minute; data is "typically within 5 minutes".
 */
import type { ProviderAdminKey } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptApiKey } from "@/lib/crypto";
import { persistBuckets, type NormalizedBucket, type SyncResult } from "./usage-sync";

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/v1/organizations/usage_report/messages";
const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicUsageResult = {
  uncached_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  api_key_id?: string | null;
  model?: string | null;
};

type AnthropicUsageBucket = {
  starting_at?: string;
  ending_at?: string;
  results?: AnthropicUsageResult[];
};

type AnthropicUsageResponse = {
  data?: AnthropicUsageBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

function inputTokensOf(r: AnthropicUsageResult): number {
  // Newer responses break input into cached/uncached; older return input_tokens.
  return (
    r.input_tokens ??
    (r.uncached_input_tokens ?? 0) + (r.cache_creation_input_tokens ?? 0) + (r.cache_read_input_tokens ?? 0)
  );
}

export async function syncAnthropicUsage(companyId: string, adminKey: ProviderAdminKey): Promise<SyncResult> {
  const key = decryptApiKey(adminKey.encryptedKey);

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const url = new URL(ANTHROPIC_USAGE_URL);
  url.searchParams.set("starting_at", oneHourAgo.toISOString());
  url.searchParams.set("ending_at", now.toISOString());
  url.searchParams.set("bucket_width", "1m");
  url.searchParams.append("group_by[]", "api_key_id");
  url.searchParams.append("group_by[]", "model");
  url.searchParams.set("limit", "60");

  const res = await fetch(url.toString(), {
    headers: {
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (res.status === 401) throw new Error("Anthropic rejected the admin key (401). Use an sk-ant-admin- key.");
  if (res.status === 429) throw new Error("Anthropic rate-limited the usage request (429). Poll at most once per minute.");
  if (!res.ok) throw new Error(`Anthropic usage endpoint returned ${res.status}.`);

  const json = (await res.json()) as AnthropicUsageResponse;

  const buckets: NormalizedBucket[] = [];
  for (const bucket of json.data ?? []) {
    for (const r of bucket.results ?? []) {
      const tokensIn = inputTokensOf(r);
      const tokensOut = r.output_tokens ?? 0;
      if (tokensIn === 0 && tokensOut === 0) continue;
      const attributionKey = r.api_key_id ?? null;
      buckets.push({
        providerApiId: `${bucket.starting_at ?? ""}:${attributionKey ?? ""}:${r.model ?? ""}`,
        tokensIn,
        tokensOut,
        model: r.model ?? null,
        attributionKey,
        metadata: { startingAt: bucket.starting_at, apiKeyId: r.api_key_id },
      });
    }
  }

  const result = await persistBuckets(companyId, adminKey.providerId, "anthropic", buckets);
  await prisma.providerAdminKey.update({ where: { id: adminKey.id }, data: { lastSyncedAt: now } });
  return result;
}

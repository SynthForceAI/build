/**
 * OpenAI org-level usage polling.
 *
 * Uses two endpoints (both require an sk-admin- key):
 *   - GET /v1/organization/usage/completions  → token counts, request counts
 *   - GET /v1/organization/costs              → actual billed USD per day per project
 *
 * Cost source-of-truth is the Costs API. Token-based estimation (pricing.ts) is
 * only used as a fallback when the Costs API hasn't surfaced recent data yet
 * (it can lag up to ~2 hours).
 *
 * Sync window: first sync backtracks 30 days with daily buckets. Subsequent syncs
 * anchor to lastSyncedAt minus a 15-minute safety buffer so no usage is missed
 * regardless of actual cron cadence (GitHub Actions fires ~every 60-90 min in
 * practice despite the cron-every-5-minutes schedule).
 */
import type { ProviderAdminKey } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptApiKey } from "@/lib/crypto";
import { persistBuckets, type NormalizedBucket, type SyncResult } from "./usage-sync";

const OPENAI_USAGE_URL = "https://api.openai.com/v1/organization/usage/completions";
const OPENAI_COSTS_URL = "https://api.openai.com/v1/organization/costs";

const FIFTEEN_MIN_MS = 15 * 60 * 1_000;
const ONE_DAY_MS     = 24 * 60 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

type OpenAICostResult = {
  amount?: { value?: number; currency?: string };
  project_id?: string | null;
};

type OpenAICostBucket = {
  start_time?: number;
  end_time?: number;
  results?: OpenAICostResult[];
};

type OpenAICostResponse = {
  data?: OpenAICostBucket[];
  has_more?: boolean;
  next_page?: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Floor a Unix timestamp (seconds) to UTC midnight of the same day. */
function dayStartUnix(ts: number): number {
  if (!ts) return 0;
  const d = new Date(ts * 1_000);
  d.setUTCHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1_000);
}

/**
 * Fetch actual billed cost from OpenAI's Costs API.
 * Returns a map of "project_id:day_start_unix" -> cost in cents.
 * Fails gracefully (returns empty map) on any API error so we can still
 * fall back to the token-based estimate.
 */
async function fetchCosts(
  key: string,
  startUnix: number,
  endUnix: number,
): Promise<Map<string, number>> {
  const costWindowStart = dayStartUnix(startUnix);
  const dayCount = Math.ceil((endUnix - costWindowStart) / 86_400) + 2;

  const url = new URL(OPENAI_COSTS_URL);
  url.searchParams.set("start_time", String(costWindowStart));
  url.searchParams.set("end_time", String(endUnix));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.append("group_by", "project_id");
  url.searchParams.set("limit", String(Math.min(dayCount, 90)));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    console.warn(`[openai-usage] costs API returned ${res.status}; falling back to estimated cost`);
    return new Map();
  }

  const json = (await res.json()) as OpenAICostResponse;
  const map = new Map<string, number>();
  for (const bucket of json.data ?? []) {
    for (const r of bucket.results ?? []) {
      const projectId = r.project_id ?? "";
      const costCents = Math.round((r.amount?.value ?? 0) * 100);
      if (costCents > 0) {
        map.set(`${projectId}:${bucket.start_time ?? 0}`, costCents);
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function syncOpenAIUsage(companyId: string, adminKey: ProviderAdminKey): Promise<SyncResult> {
  const key = decryptApiKey(adminKey.encryptedKey);
  const now = new Date();
  const nowUnix = Math.floor(now.getTime() / 1_000);

  const isFirstSync = adminKey.lastSyncedAt === null;

  // Compute sync window and bucket granularity.
  let lookbackStart: Date;
  let bucketWidth: string;
  let limit: number;

  if (isFirstSync) {
    lookbackStart = new Date(now.getTime() - 30 * ONE_DAY_MS);
    bucketWidth = "1d";
    limit = 90;
  } else {
    // Anchor to last successful sync minus a safety buffer so that any gap
    // caused by GitHub Actions' variable cron cadence is always covered.
    // Re-fetched buckets safely dedup on (connectedAgentId, providerApiId).
    lookbackStart = new Date(adminKey.lastSyncedAt!.getTime() - FIFTEEN_MIN_MS);
    const spanMs = now.getTime() - lookbackStart.getTime();
    if (spanMs <= ONE_DAY_MS) {
      bucketWidth = "1m";
      limit = Math.min(1_440, Math.ceil(spanMs / 60_000) + 10);
    } else {
      // OpenAI caps 1m granularity to short ranges; fall back to 1h for longer windows.
      bucketWidth = "1h";
      limit = Math.min(744, Math.ceil(spanMs / 3_600_000) + 2);
    }
  }

  const startUnix = Math.floor(lookbackStart.getTime() / 1_000);

  // Fetch usage (tokens + request counts).
  // Build the base URL via URLSearchParams, then append group_by[] as a raw
  // string — URLSearchParams would encode [] as %5B%5D which OpenAI rejects.
  const usageBaseUrl = new URL(OPENAI_USAGE_URL);
  usageBaseUrl.searchParams.set("start_time", String(startUnix));
  usageBaseUrl.searchParams.set("end_time", String(nowUnix));
  usageBaseUrl.searchParams.set("bucket_width", bucketWidth);
  usageBaseUrl.searchParams.set("limit", String(limit));
  const usageUrlStr = `${usageBaseUrl.toString()}&group_by[]=model&group_by[]=project_id`;

  console.log('[sync-debug] Fetching usage with URL:', usageUrlStr);
  const res = await fetch(usageUrlStr, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "(unreadable)");
    console.error(`[sync-debug] OpenAI usage endpoint error: status=${res.status} body=${errBody}`);
    if (res.status === 401) throw new Error("OpenAI rejected the admin key (401). Use an sk-admin- key with usage read access.");
    if (res.status === 429) throw new Error("OpenAI rate-limited the usage request (429).");
    throw new Error(`OpenAI usage endpoint returned ${res.status}: ${errBody}`);
  }

  const json = (await res.json()) as OpenAIUsageResponse;

  // Build buckets without cost first.  We also carry _projectId / _dayStart
  // as scratch fields so we can distribute daily costs below.
  type ScratchBucket = NormalizedBucket & { _projectId: string; _dayStart: number };
  const scratch: ScratchBucket[] = [];

  for (const bucket of json.data ?? []) {
    for (const r of bucket.results ?? []) {
      const tokensIn  = r.input_tokens  ?? 0;
      const tokensOut = r.output_tokens ?? 0;
      if (tokensIn === 0 && tokensOut === 0) continue;

      // Log raw model strings to help confirm pricing.ts fallback coverage.
      if (r.model) {
        console.log(`[openai-usage] model="${r.model}" in:${tokensIn} out:${tokensOut} reqs:${r.num_model_requests ?? 0}`);
      }

      const attributionKey = r.project_id ?? r.api_key_id ?? null;
      scratch.push({
        providerApiId: `${bucket.start_time ?? 0}:${attributionKey ?? ""}:${r.model ?? ""}`,
        tokensIn,
        tokensOut,
        numRequests:   r.num_model_requests ?? 0,
        model:         r.model ?? null,
        attributionKey,
        metadata: {
          startTime:   bucket.start_time,
          projectId:   r.project_id,
          apiKeyId:    r.api_key_id,
          numRequests: r.num_model_requests,
        },
        _projectId: r.project_id ?? "",
        _dayStart:  dayStartUnix(bucket.start_time ?? 0),
      });
    }
  }

  // Fetch actual billed costs and distribute them proportionally across
  // same-(project, day) buckets by token share.
  const costMap = await fetchCosts(key, startUnix, nowUnix);

  const scratchCount = scratch.length;
  console.log('[sync-debug] OpenAI usage response:', {
    bucketsCount: json.data?.length ?? 0,
    scratchBuckets: scratchCount,
    startTime: startUnix,
    endTime: nowUnix,
    firstBucket: json.data?.[0],
  });

  // Sum tokens per (project_id, day) for proportional distribution.
  const dayTokenTotals = new Map<string, number>();
  for (const b of scratch) {
    const dayKey = `${b._projectId}:${b._dayStart}`;
    dayTokenTotals.set(dayKey, (dayTokenTotals.get(dayKey) ?? 0) + b.tokensIn + b.tokensOut);
  }

  const buckets: NormalizedBucket[] = scratch.map(({ _projectId, _dayStart, ...b }) => {
    const dayKey = `${_projectId}:${_dayStart}`;
    const dailyCostCents = costMap.get(dayKey);
    if (dailyCostCents !== undefined && dailyCostCents > 0) {
      const totalTokens  = dayTokenTotals.get(dayKey) ?? 0;
      const bucketTokens = b.tokensIn + b.tokensOut;
      return { ...b, costCents: totalTokens > 0 ? (dailyCostCents * bucketTokens) / totalTokens : 0 };
    }
    // Costs API hasn't surfaced this day yet — persistBuckets will estimate from tokens.
    return b;
  });

  const result = await persistBuckets(companyId, adminKey.providerId, "openai", buckets);
  await prisma.providerAdminKey.update({ where: { id: adminKey.id }, data: { lastSyncedAt: now } });
  return result;
}

// ---------------------------------------------------------------------------
// One-shot diagnostic — not called in production
// ---------------------------------------------------------------------------

export async function testOpenAIKeyRequest(): Promise<void> {
  const adminKey = await prisma.providerAdminKey.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!adminKey) {
    console.log("[test] No ProviderAdminKey rows found in the database.");
    return;
  }

  const key = decryptApiKey(adminKey.encryptedKey);
  console.log(`[test] Using key id=${adminKey.id} prefix=${key.slice(0, 12)}...`);

  const nowSec = Math.floor(Date.now() / 1_000);
  const thirtyDaysAgo = nowSec - 30 * 24 * 60 * 60;
  const url = `https://api.openai.com/v1/organization/usage/completions?bucket_width=1d&start_time=${thirtyDaysAgo}&end_time=${nowSec}&limit=90&group_by[]=model&group_by[]=project_id`;
  console.log("[test] GET", url);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  const body = await res.text();
  console.log(`[test] status=${res.status}`);
  try {
    console.log("[test] body:", JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log("[test] body (raw):", body);
  }

  await prisma.$disconnect();
}

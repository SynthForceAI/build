/**
 * OpenAI billing data puller.
 *
 * Hits the deprecated-but-still-functional dashboard billing endpoints to
 * pull usage history. OpenAI has removed these from public docs in favor
 * of the Usage API; if those go away entirely we'll need to switch to
 * the per-organization Usage API endpoints + cost calculation from
 * provider_models prices.
 *
 * Returns a normalized shape independent of the provider. The audit
 * engine consumes this shape, not the raw response.
 */

import { decryptApiKey } from "../crypto";

const OPENAI_BASE = "https://api.openai.com/v1";

/** Normalized shape consumed by the audit engine. */
export type ProviderUsageReport = {
  provider:         "openai";
  periodStart:      Date;
  periodEnd:        Date;
  totalCostCents:   number;   // integer cents (rounded from USD * 100)
  totalCalls:       number;
  totalTokensIn:    number;
  totalTokensOut:   number;
  /** Per-day spend, oldest first. */
  dailySpendCents:  Array<{ date: string; costCents: number; calls: number }>;
  /** Per-model breakdown across the whole period. */
  byModel:          Array<{
    model:        string;
    costCents:    number;
    calls:        number;
    tokensIn:     number;
    tokensOut:    number;
  }>;
  /** Raw responses kept for auditing reproducibility. */
  rawResponses:     Array<{ source: string; body: unknown }>;
};

export class OpenAIPullerError extends Error {
  constructor(public readonly code: "invalid_key" | "rate_limited" | "network" | "unexpected", message: string) {
    super(message);
    this.name = "OpenAIPullerError";
  }
}

type FetchOpts = { encryptedKey: string; periodDays?: number };

export async function fetchOpenAIUsage({
  encryptedKey,
  periodDays = 30,
}: FetchOpts): Promise<ProviderUsageReport> {
  const apiKey = decryptApiKey(encryptedKey);

  const end   = new Date();
  const start = new Date(end.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // 1. Validate the key + pull aggregate usage.
  const usageUrl = new URL(`${OPENAI_BASE}/dashboard/billing/usage`);
  usageUrl.searchParams.set("start_date", isoDate(start));
  usageUrl.searchParams.set("end_date",   isoDate(end));

  const usageRes = await safeFetch(usageUrl, apiKey);
  if (usageRes.status === 401) throw new OpenAIPullerError("invalid_key", "OpenAI rejected the key.");
  if (usageRes.status === 429) throw new OpenAIPullerError("rate_limited", "OpenAI rate-limited the request.");
  if (!usageRes.ok)            throw new OpenAIPullerError("unexpected", `Usage endpoint returned ${usageRes.status}.`);

  const usageJson = await usageRes.json() as OpenAIUsageResponse;

  // 2. Pull the list of available models (for display + sanity-check).
  const modelsRes = await safeFetch(new URL(`${OPENAI_BASE}/models`), apiKey);
  const modelsJson = modelsRes.ok ? await modelsRes.json() : { data: [] };

  return normalizeOpenAI(usageJson, modelsJson, start, end);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function safeFetch(url: URL, apiKey: string) {
  try {
    return await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Vercel functions cap at ~10s on Hobby — give us some headroom but
      // don't hang forever if OpenAI is slow.
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    throw new OpenAIPullerError("network", err instanceof Error ? err.message : "network error");
  }
}

type OpenAIUsageResponse = {
  object: string;
  daily_costs?: Array<{
    timestamp: number;
    line_items?: Array<{ name: string; cost: number }>;
  }>;
  total_usage?: number; // legacy field, undocumented but present
};

/**
 * Normalize OpenAI's billing response into our generic shape.
 *
 * The dashboard billing endpoints have changed format over time. We code
 * defensively — missing fields become zeros — rather than throwing on
 * shape mismatches the customer can't debug.
 */
export function normalizeOpenAI(
  usage: OpenAIUsageResponse,
  models: unknown,
  periodStart: Date,
  periodEnd: Date,
): ProviderUsageReport {
  const byModelMap = new Map<string, { costCents: number; calls: number; tokensIn: number; tokensOut: number }>();
  const dailySpendCents: ProviderUsageReport["dailySpendCents"] = [];

  let totalCostCents = 0;
  let totalCalls     = 0;

  for (const day of usage.daily_costs ?? []) {
    const dateStr = new Date(day.timestamp * 1000).toISOString().slice(0, 10);
    let dayCostCents = 0;
    let dayCalls     = 0;
    for (const item of day.line_items ?? []) {
      // OpenAI returns USD (already in cents in some versions — coerce to cents).
      // The legacy response has costs in USD cents already (cost = $0.01 → 1).
      const costCents = Math.round(item.cost);
      dayCostCents   += costCents;

      const bucket = byModelMap.get(item.name) ?? { costCents: 0, calls: 0, tokensIn: 0, tokensOut: 0 };
      bucket.costCents += costCents;
      // Billing API doesn't break out per-call or per-token counts; leave 0.
      byModelMap.set(item.name, bucket);
    }
    dailySpendCents.push({ date: dateStr, costCents: dayCostCents, calls: dayCalls });
    totalCostCents += dayCostCents;
    totalCalls     += dayCalls;
  }

  const byModel = Array.from(byModelMap.entries())
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.costCents - a.costCents);

  return {
    provider:        "openai",
    periodStart,
    periodEnd,
    totalCostCents,
    totalCalls,
    totalTokensIn:   0, // billing API doesn't return token counts
    totalTokensOut:  0,
    dailySpendCents,
    byModel,
    rawResponses: [
      { source: "openai_billing_usage", body: usage },
      { source: "openai_models",        body: models },
    ],
  };
}

/**
 * Usage data fetchers for the free audit flow.
 *
 * These hit the provider's usage/reporting APIs directly and return
 * a normalized ProviderUsageReport for the audit engine. They are
 * intentionally separate from the ongoing sync path (lib/providers/)
 * because the audit is a one-shot pull for a 30-day window, whereas
 * the sync job runs incrementally.
 */

import { decryptApiKey } from "../crypto";
import { calculateCostCents } from "../providers/pricing";
import type { ProviderUsageReport } from "../providers/openai-billing";

// ---------------------------------------------------------------------------
// OpenAI - Organization Usage API (requires sk-admin- key)
// ---------------------------------------------------------------------------

const OPENAI_USAGE_URL = "https://api.openai.com/v1/organization/usage/completions";
const OPENAI_COSTS_URL = "https://api.openai.com/v1/organization/costs";

type OAIUsageResult = {
  input_tokens?: number;
  output_tokens?: number;
  input_cached_tokens?: number;
  num_model_requests?: number;
  project_id?: string | null;
  model?: string | null;
};
type OAIUsageBucket = { start_time?: number; results?: OAIUsageResult[] };
type OAIUsageResponse = { data?: OAIUsageBucket[] };

type OAICostResult = { amount?: { value?: number }; project_id?: string | null };
type OAICostBucket = { start_time?: number; results?: OAICostResult[] };
type OAICostResponse = { data?: OAICostBucket[] };

async function fetchOpenAIAuditData(apiKey: string, periodDays: number): Promise<ProviderUsageReport> {
  const now    = new Date();
  const start  = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const nowSec = Math.floor(now.getTime() / 1000);
  const startSec = Math.floor(start.getTime() / 1000);

  const usageUrlObj = new URL(OPENAI_USAGE_URL);
  usageUrlObj.searchParams.set("start_time", String(startSec));
  usageUrlObj.searchParams.set("end_time", String(nowSec));
  usageUrlObj.searchParams.set("bucket_width", "1d");
  usageUrlObj.searchParams.set("limit", "31");
  usageUrlObj.searchParams.append("group_by", "model");
  const usageUrl = usageUrlObj.toString();

  const costsUrlObj = new URL(OPENAI_COSTS_URL);
  costsUrlObj.searchParams.set("start_time", String(startSec));
  costsUrlObj.searchParams.set("end_time", String(nowSec));
  costsUrlObj.searchParams.set("bucket_width", "1d");
  costsUrlObj.searchParams.set("limit", "31");
  costsUrlObj.searchParams.append("group_by", "project_id");
  const costsUrl = costsUrlObj.toString();

  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const signal  = AbortSignal.timeout(25_000);

  const [usageRes, costsRes] = await Promise.all([
    fetch(usageUrl, { headers, signal }),
    fetch(costsUrl, { headers, signal: AbortSignal.timeout(25_000) }),
  ]);

  if (usageRes.status === 401) throw new Error("OpenAI rejected the admin key (401). Use an sk-admin- key with usage read access.");
  if (usageRes.status === 403) throw new Error("This key lacks usage API access (403). Ensure the admin key has 'Read usage data' scope in the OpenAI dashboard.");
  if (usageRes.status === 429) throw new Error("OpenAI rate-limited the request (429). Try again in a minute.");
  if (!usageRes.ok) {
    const body = await usageRes.text().catch(() => "");
    throw new Error(`OpenAI usage endpoint returned ${usageRes.status}. ${body}`.trim());
  }

  const usageJson = (await usageRes.json()) as OAIUsageResponse;

  // Aggregate actual costs per day (across all projects).
  const dailyCostCents = new Map<number, number>();
  if (costsRes.ok) {
    const costsJson = (await costsRes.json()) as OAICostResponse;
    for (const bucket of costsJson.data ?? []) {
      const day = bucket.start_time ?? 0;
      const cents = (bucket.results ?? []).reduce(
        (sum, r) => sum + Math.round((r.amount?.value ?? 0) * 100), 0,
      );
      dailyCostCents.set(day, (dailyCostCents.get(day) ?? 0) + cents);
    }
  }

  // Aggregate tokens per (day, model).
  type DayModel = { tokensIn: number; tokensOut: number; requests: number; tokensInCached: number };
  const byDayModel = new Map<string, DayModel>();
  const dayTokenTotals = new Map<number, number>();

  for (const bucket of usageJson.data ?? []) {
    const day = bucket.start_time ?? 0;
    for (const r of bucket.results ?? []) {
      const tokensIn  = r.input_tokens ?? 0;
      const tokensOut = r.output_tokens ?? 0;
      if (tokensIn === 0 && tokensOut === 0) continue;
      const key = `${day}:${r.model ?? "unknown"}`;
      const cur = byDayModel.get(key) ?? { tokensIn: 0, tokensOut: 0, requests: 0, tokensInCached: 0 };
      cur.tokensIn       += tokensIn;
      cur.tokensOut      += tokensOut;
      cur.requests       += r.num_model_requests ?? 0;
      cur.tokensInCached += r.input_cached_tokens ?? 0;
      byDayModel.set(key, cur);
      dayTokenTotals.set(day, (dayTokenTotals.get(day) ?? 0) + tokensIn + tokensOut);
    }
  }

  // Build per-model totals and per-day spend.
  const modelTotals = new Map<string, { costCents: number; calls: number; tokensIn: number; tokensOut: number; tokensInCached: number }>();
  const dailySpendMap = new Map<number, number>();

  for (const [key, dm] of byDayModel) {
    const sep = key.indexOf(":");
    const day   = Number(key.slice(0, sep));
    const model = key.slice(sep + 1);

    const totalTokens  = dayTokenTotals.get(day) ?? 0;
    const bucketTokens = dm.tokensIn + dm.tokensOut;
    const dailyCents   = dailyCostCents.get(day);

    let costCents: number;
    if (dailyCents !== undefined && dailyCents > 0 && totalTokens > 0) {
      costCents = Math.round(dailyCents * (bucketTokens / totalTokens));
    } else {
      costCents = calculateCostCents("openai", model, dm.tokensIn, dm.tokensOut);
    }

    dailySpendMap.set(day, (dailySpendMap.get(day) ?? 0) + costCents);

    const mt = modelTotals.get(model) ?? { costCents: 0, calls: 0, tokensIn: 0, tokensOut: 0, tokensInCached: 0 };
    mt.costCents      += costCents;
    mt.calls          += dm.requests;
    mt.tokensIn       += dm.tokensIn;
    mt.tokensOut      += dm.tokensOut;
    mt.tokensInCached += dm.tokensInCached;
    modelTotals.set(model, mt);
  }

  const dailySpendCents = Array.from(dailySpendMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, costCents]) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      costCents,
      calls: 0,
    }));

  const byModel = Array.from(modelTotals.entries())
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.costCents - a.costCents);

  const totalCostCents = byModel.reduce((s, m) => s + m.costCents, 0);
  const totalCalls     = byModel.reduce((s, m) => s + m.calls, 0);
  const totalTokensIn  = byModel.reduce((s, m) => s + m.tokensIn, 0);
  const totalTokensOut = byModel.reduce((s, m) => s + m.tokensOut, 0);

  return {
    provider: "openai",
    periodStart: start,
    periodEnd: now,
    totalCostCents,
    totalCalls,
    totalTokensIn,
    totalTokensOut,
    dailySpendCents,
    byModel,
    rawResponses: [{ source: "openai_usage_completions", body: usageJson }],
  };
}

// ---------------------------------------------------------------------------
// Anthropic - Org Usage Report API (requires sk-ant-admin- key)
// ---------------------------------------------------------------------------

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/v1/organizations/usage_report/messages";
const ANTHROPIC_VERSION   = "2023-06-01";

type AntUsageResult = {
  input_tokens?: number;
  uncached_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  api_key_id?: string | null;
  model?: string | null;
};
type AntUsageBucket = { starting_at?: string; ending_at?: string; results?: AntUsageResult[] };
type AntUsageResponse = { data?: AntUsageBucket[] };

async function fetchAnthropicAuditData(apiKey: string, periodDays: number): Promise<ProviderUsageReport> {
  const now   = new Date();
  const start = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const baseParams = new URLSearchParams({
    starting_at:  start.toISOString(),
    ending_at:    now.toISOString(),
    bucket_width: "1d",
    limit:        "31",
  });
  // group_by[] must be literal brackets — URLSearchParams encodes them to %5B%5D which Anthropic rejects.
  const urlStr = `${ANTHROPIC_USAGE_URL}?${baseParams.toString()}&group_by[]=api_key_id&group_by[]=model`;

  const res = await fetch(urlStr, {
    headers: {
      "x-api-key":          apiKey,
      "anthropic-version":  ANTHROPIC_VERSION,
      "Content-Type":       "application/json",
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (res.status === 401) throw new Error("Anthropic rejected the admin key (401). Use an sk-ant-admin key.");
  if (res.status === 403) throw new Error("This key lacks org access (403). Create an Admin key in the Anthropic Console.");
  if (res.status === 429) throw new Error("Anthropic rate-limited the usage request (429). Try again in a minute.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic usage endpoint returned ${res.status}. ${body}`.trim());
  }

  const json = (await res.json()) as AntUsageResponse;

  type DayModel = { tokensIn: number; tokensOut: number; tokensInCached: number };
  const byDayModel = new Map<string, DayModel>();

  for (const bucket of json.data ?? []) {
    const day = bucket.starting_at?.slice(0, 10) ?? "unknown";
    for (const r of bucket.results ?? []) {
      const cachedRead = r.cache_read_input_tokens ?? 0;
      const tokensIn =
        r.input_tokens ??
        (r.uncached_input_tokens ?? 0) +
        (r.cache_creation_input_tokens ?? 0) +
        cachedRead;
      const tokensOut = r.output_tokens ?? 0;
      if (tokensIn === 0 && tokensOut === 0) continue;
      const key = `${day}:${r.model ?? "unknown"}`;
      const cur = byDayModel.get(key) ?? { tokensIn: 0, tokensOut: 0, tokensInCached: 0 };
      cur.tokensIn       += tokensIn;
      cur.tokensOut      += tokensOut;
      cur.tokensInCached += cachedRead;
      byDayModel.set(key, cur);
    }
  }

  const modelTotals = new Map<string, { costCents: number; calls: number; tokensIn: number; tokensOut: number; tokensInCached: number }>();
  const dailySpendMap = new Map<string, number>();

  for (const [key, dm] of byDayModel) {
    const sep   = key.indexOf(":");
    const day   = key.slice(0, sep);
    const model = key.slice(sep + 1);
    const cost  = calculateCostCents("anthropic", model, dm.tokensIn, dm.tokensOut);

    dailySpendMap.set(day, (dailySpendMap.get(day) ?? 0) + cost);

    const mt = modelTotals.get(model) ?? { costCents: 0, calls: 0, tokensIn: 0, tokensOut: 0, tokensInCached: 0 };
    mt.costCents      += cost;
    mt.tokensIn       += dm.tokensIn;
    mt.tokensOut      += dm.tokensOut;
    mt.tokensInCached += dm.tokensInCached;
    modelTotals.set(model, mt);
  }

  const dailySpendCents = Array.from(dailySpendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, costCents]) => ({ date, costCents, calls: 0 }));

  const byModel = Array.from(modelTotals.entries())
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.costCents - a.costCents);

  const totalCostCents = byModel.reduce((s, m) => s + m.costCents, 0);
  const totalTokensIn  = byModel.reduce((s, m) => s + m.tokensIn, 0);
  const totalTokensOut = byModel.reduce((s, m) => s + m.tokensOut, 0);

  return {
    provider: "anthropic",
    periodStart: start,
    periodEnd: now,
    totalCostCents,
    totalCalls: 0,
    totalTokensIn,
    totalTokensOut,
    dailySpendCents,
    byModel,
    rawResponses: [{ source: "anthropic_usage_report", body: json }],
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function fetchAuditData(
  providerName: string,
  encryptedKey: string,
  periodDays = 30,
): Promise<ProviderUsageReport> {
  const apiKey = decryptApiKey(encryptedKey);
  switch (providerName) {
    case "openai":
      return fetchOpenAIAuditData(apiKey, periodDays);
    case "anthropic":
      return fetchAnthropicAuditData(apiKey, periodDays);
    default:
      throw new Error(`Audit data pull is not yet supported for provider "${providerName}". Supported: openai, anthropic.`);
  }
}

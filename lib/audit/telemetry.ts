/**
 * Advanced telemetry calculations for Phase 2 Part 1.
 *
 * Consumes a ProviderUsageReport (after fetch-usage.ts has run) and returns
 * structured TelemetryInsights. All calculations are deterministic and pure —
 * no I/O, no LLM.
 */
import type { ProviderUsageReport } from "../providers/openai-billing";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HighVolumeProject = {
  projectId:      string;
  costCents:      number;
  prevCostCents:  number;
  momChangePct:   number;
  spendSharePct:  number;
  isOutlier:      boolean;
  calls:          number;
};

export type ModelMismatchCandidate = {
  model:                  string;
  costCents:              number;
  callCount:              number;
  avgOutputTokens:        number;
  suggestedModel:         string;
  estimatedSavingsCents:  number;
  savingsPct:             number;
  confidence:             "high" | "medium" | "low";
};

export type ModelMismatch = {
  candidates: ModelMismatchCandidate[];
};

export type CacheEfficiency = {
  totalInputTokens:     number;
  cachedTokens:         number;
  cacheHitRatePct:      number;
  benchmarkPct:         number;
  potentialSavingsCents: number;
  recommendation:       string;
};

export type ReasoningEfficiency = {
  models: Array<{
    model:                    string;
    avgReasoningTokensPerCall: number;
    avgOutputTokensPerCall:   number;
    ratio:                    number;
    costCents:                number;
    recommendation:           string;
  }>;
};

export type BatchOpportunity = {
  realtimeCostCents:      number;
  realtimeCalls:          number;
  estimatedSavingsCents:  number;
  savingsPct:             number;
  eligible:               boolean;
};

export type UnusedKey = {
  apiKeyId:  string;
  calls:     number;
  costCents: number;
  isUnused:  boolean;
};

export type TelemetryInsights = {
  provider:            "openai" | "anthropic";
  highVolumeProjects:  HighVolumeProject[] | null;   // null = data unavailable
  modelMismatch:       ModelMismatch | null;
  cacheEfficiency:     CacheEfficiency | null;        // Anthropic only
  reasoningEfficiency: ReasoningEfficiency | null;    // OpenAI o1 only
  batchOpportunity:    BatchOpportunity | null;       // OpenAI only
  unusedKeys:          UnusedKey[] | null;            // OpenAI only
};

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

export function calculateTelemetry(report: ProviderUsageReport): TelemetryInsights {
  const provider = report.provider as "openai" | "anthropic";

  return {
    provider,
    highVolumeProjects:  calcHighVolumeProjects(report),
    modelMismatch:       calcModelMismatch(report),
    cacheEfficiency:     calcCacheEfficiency(report),
    reasoningEfficiency: calcReasoningEfficiency(report),
    batchOpportunity:    calcBatchOpportunity(report),
    unusedKeys:          calcUnusedKeys(report),
  };
}

// ---------------------------------------------------------------------------
// High-volume projects
// ---------------------------------------------------------------------------

function calcHighVolumeProjects(report: ProviderUsageReport): HighVolumeProject[] | null {
  // OpenAI: use projectSpend from extended fetch
  if (report.provider === "openai") {
    if (!report.projectSpend || report.projectSpend.length === 0) return null;

    const totalSpend = report.projectSpend.reduce((s, p) => s + p.costCents, 0);
    const sorted = [...report.projectSpend].sort((a, b) => b.costCents - a.costCents);
    const top20PercentCount = Math.max(1, Math.ceil(sorted.length * 0.2));

    return sorted.map((p, idx) => {
      const spendSharePct = totalSpend > 0 ? (p.costCents / totalSpend) * 100 : 0;
      const momChangePct  = p.prevCostCents > 0
        ? ((p.costCents - p.prevCostCents) / p.prevCostCents) * 100
        : 0;
      const isOutlier = idx < top20PercentCount && spendSharePct > 20;
      return {
        projectId:     p.projectId,
        costCents:     p.costCents,
        prevCostCents: p.prevCostCents,
        momChangePct:  Math.round(momChangePct * 10) / 10,
        spendSharePct: Math.round(spendSharePct * 10) / 10,
        isOutlier,
        calls:         p.calls,
      };
    });
  }

  // Anthropic: no project-level data — workspace is always a single bucket.
  // Return null so the UI shows the unavailability message.
  return null;
}

// ---------------------------------------------------------------------------
// Model mismatch
// ---------------------------------------------------------------------------

function calcModelMismatch(report: ProviderUsageReport): ModelMismatch | null {
  const candidates: ModelMismatchCandidate[] = [];

  for (const m of report.byModel) {
    if (m.calls < 100) continue;

    const avgOutputTokens = m.calls > 0 ? m.tokensOut / m.calls : 0;
    if (avgOutputTokens >= 500) continue; // not overkill if generating long outputs

    const name = m.model.toLowerCase();

    let suggestedModel: string | null = null;
    let savingsFraction = 0;
    let confidence: "high" | "medium" | "low" = "medium";

    if (/^gpt-4(?!o)/i.test(m.model) || name.startsWith("gpt-4-")) {
      // Legacy GPT-4 or GPT-4-turbo
      suggestedModel   = "gpt-4o-mini";
      savingsFraction  = 0.90; // 90% of cost saved
      confidence       = avgOutputTokens < 200 ? "high" : "medium";
    } else if (/^gpt-4/i.test(m.model) && !name.includes("mini") && !name.includes("nano")) {
      // gpt-4o or other gpt-4 variants
      suggestedModel   = "gpt-4o-mini";
      savingsFraction  = 0.90;
      confidence       = avgOutputTokens < 200 ? "high" : "medium";
    } else if (/claude-3-opus/i.test(m.model)) {
      suggestedModel  = "claude-3-haiku";
      savingsFraction = 0.80;
      confidence      = avgOutputTokens < 200 ? "high" : "medium";
    } else if (/claude-3-5-sonnet/i.test(m.model)) {
      suggestedModel  = "claude-haiku-3-5";
      savingsFraction = 0.70;
      confidence      = avgOutputTokens < 200 ? "high" : "medium";
    } else {
      continue; // model not in overkill list
    }

    const estimatedSavingsCents = Math.round(m.costCents * savingsFraction);
    const savingsPct            = savingsFraction * 100;

    // Only include if savings > $1/month
    if (estimatedSavingsCents < 100) continue;

    candidates.push({
      model:                 m.model,
      costCents:             m.costCents,
      callCount:             m.calls,
      avgOutputTokens:       Math.round(avgOutputTokens),
      suggestedModel,
      estimatedSavingsCents,
      savingsPct,
      confidence,
    });
  }

  if (candidates.length === 0) return null;
  return { candidates };
}

// ---------------------------------------------------------------------------
// Cache efficiency (Anthropic only)
// ---------------------------------------------------------------------------

function calcCacheEfficiency(report: ProviderUsageReport): CacheEfficiency | null {
  if (report.provider !== "anthropic") return null;

  const totalInputTokens = report.byModel.reduce((s, m) => s + m.tokensIn, 0);
  const cachedTokens     = report.byModel.reduce((s, m) => s + (m.tokensInCached ?? 0), 0);

  if (totalInputTokens === 0) return null;

  const cacheHitRatePct = (cachedTokens / totalInputTokens) * 100;
  const benchmarkPct    = 70;

  // Potential savings: if rate < 50%, there's headroom
  let potentialSavingsCents = 0;
  if (cacheHitRatePct < 50) {
    // Tokens we *could* have served from cache but didn't
    const uncachedExcess      = totalInputTokens * 0.5 - cachedTokens;
    const uncachedExcessClamped = Math.max(0, uncachedExcess);
    // Anthropic cache reads cost $0.00003/1K (~90% off full input price)
    // Savings per token ≈ full price - cached price ≈ $0.000003 (rough average across models)
    potentialSavingsCents = Math.round(uncachedExcessClamped * 0.000003 * 100);
  }

  return {
    totalInputTokens,
    cachedTokens,
    cacheHitRatePct: Math.round(cacheHitRatePct * 10) / 10,
    benchmarkPct,
    potentialSavingsCents,
    recommendation: "Structure your prompts with static content first to increase cache reuse.",
  };
}

// ---------------------------------------------------------------------------
// Reasoning efficiency (OpenAI o1/o3 only)
// ---------------------------------------------------------------------------

function calcReasoningEfficiency(report: ProviderUsageReport): ReasoningEfficiency | null {
  if (report.provider !== "openai") return null;

  const reasoningModels = report.byModel.filter((m) => /^o1/i.test(m.model) || /^o3/i.test(m.model));
  if (reasoningModels.length === 0) return null;

  const models = reasoningModels.map((m) => {
    const avgReasoningTokensPerCall = m.calls > 0 ? m.tokensIn / m.calls : 0;
    const avgOutputTokensPerCall    = m.calls > 0 ? m.tokensOut / m.calls : 0;
    const ratio = avgOutputTokensPerCall > 0 ? avgReasoningTokensPerCall / avgOutputTokensPerCall : 0;

    const recommendation = ratio > 10
      ? "Consider GPT-4o for this task — it handles most requests without extended reasoning at 80% lower cost."
      : "Reasoning token usage looks proportionate to output.";

    return {
      model:                     m.model,
      avgReasoningTokensPerCall: Math.round(avgReasoningTokensPerCall),
      avgOutputTokensPerCall:    Math.round(avgOutputTokensPerCall),
      ratio:                     Math.round(ratio * 10) / 10,
      costCents:                 m.costCents,
      recommendation,
    };
  });

  return { models };
}

// ---------------------------------------------------------------------------
// Batch opportunity (OpenAI only)
// ---------------------------------------------------------------------------

function calcBatchOpportunity(report: ProviderUsageReport): BatchOpportunity | null {
  if (report.provider !== "openai") return null;

  let realtimeCostCents: number;
  let realtimeCalls: number;

  if (report.batchVsRealtime && report.batchVsRealtime.length > 0) {
    const realtime = report.batchVsRealtime.find((b) => !b.isBatch);
    realtimeCostCents = realtime?.costCents ?? 0;
    realtimeCalls     = realtime?.calls     ?? 0;
  } else {
    // Conservative fallback: assume all spend is realtime (nothing batched yet)
    realtimeCostCents = report.totalCostCents;
    realtimeCalls     = report.totalCalls;
  }

  const eligible              = realtimeCalls > 500 && realtimeCostCents > 500;
  // 50% batch discount, assume 60% of calls are eligible for batching
  const estimatedSavingsCents = Math.round(realtimeCostCents * 0.5 * 0.6);
  const savingsPct            = realtimeCostCents > 0
    ? Math.round((estimatedSavingsCents / realtimeCostCents) * 100)
    : 0;

  return {
    realtimeCostCents,
    realtimeCalls,
    estimatedSavingsCents,
    savingsPct,
    eligible,
  };
}

// ---------------------------------------------------------------------------
// Unused API keys (OpenAI only)
// ---------------------------------------------------------------------------

function calcUnusedKeys(report: ProviderUsageReport): UnusedKey[] | null {
  if (report.provider !== "openai") return null;
  if (!report.apiKeyActivity) return null; // key lacked permission — surface that in UI

  return report.apiKeyActivity.map((k) => ({
    apiKeyId:  k.apiKeyId,
    calls:     k.calls,
    costCents: k.costCents,
    isUnused:  k.calls === 0,
  }));
}

/**
 * Deterministic audit analysis.
 *
 * Inputs: a normalized ProviderUsageReport.
 * Output: a list of structured Findings + a top-line metrics object that
 *         will be stored on the audit row and rendered on the LoginDashboard.
 *
 * All math here is pure — given the same input, returns the same output.
 * No I/O, no LLM. The LLM step (report.ts) is separate and only writes
 * the prose summary.
 */
import type { ProviderUsageReport } from "../providers/openai-billing";

export type FindingSeed = {
  type:                  "model_optimization" | "idle_cost" | "cost_spike" | "provider_comparison" | "benchmark" | "spend_trend" | "underuse";
  severity:              "info" | "low" | "medium" | "high" | "critical";
  title:                 string;
  description:           string;
  potentialSavingsCents: number | null;
  metadata:              Record<string, unknown>;
  orderHint:             number;
};

export type DiscoveredAgentSeed = {
  name:             string;
  model:            string;
  providerName:     string;
  tasksCompleted:   number;
  totalCostCents:   number;
  totalTokensIn:    number;
  totalTokensOut:   number;
  efficiencyRating: "good" | "fair" | "poor" | "unknown";
  details:          Record<string, unknown>;
};

export type AuditAnalysis = {
  totalMonthlySpendCents: number;
  estimatedWasteCents:    number;
  efficiencyScore:        number; // 0-100
  totalApiCalls:          number;
  totalTokensIn:          number;
  totalTokensOut:         number;
  findings:               FindingSeed[];
  discoveredAgents:       DiscoveredAgentSeed[];
};

// ---------------------------------------------------------------------------
// Rule constants. Tunable; revisit as we get real customer data.
// ---------------------------------------------------------------------------

/** Fraction of GPT-4 spend assumed swappable to gpt-4o-mini. */
const GPT4_SWAP_RATIO = 0.66;

/** GPT-4 input price ratio vs GPT-4o-mini (rough — see seed.ts for exact). */
const GPT4_VS_MINI_PRICE_RATIO = 0.0000025 / 0.00000015; // ~16x cheaper input

/** Threshold: GPT-4 > this fraction of total spend triggers "over-optimized". */
const GPT4_HEAVY_THRESHOLD = 0.30;

/** A daily spend > N× the period average flags a cost spike. */
const SPIKE_MULTIPLIER = 2.0;

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

export function analyze(report: ProviderUsageReport): AuditAnalysis {
  const findings: FindingSeed[] = [];

  const totalMonthlySpendCents = report.totalCostCents;
  const byModel = report.byModel;
  const totalCalls = report.totalCalls;

  // ---- Model optimization -------------------------------------------------
  const gpt4Spend = sum(byModel.filter((m) => /^gpt-4(?!o)/i.test(m.model)).map((m) => m.costCents));
  const gpt4Share = totalMonthlySpendCents > 0 ? gpt4Spend / totalMonthlySpendCents : 0;
  let modelWasteCents = 0;
  if (gpt4Share > GPT4_HEAVY_THRESHOLD) {
    // Estimate: GPT_4_SWAP_RATIO of GPT-4 spend is excess vs gpt-4o-mini.
    modelWasteCents = Math.round(gpt4Spend * GPT4_SWAP_RATIO * (1 - 1 / GPT4_VS_MINI_PRICE_RATIO));
    findings.push({
      type:     "model_optimization",
      severity: gpt4Share > 0.6 ? "high" : "medium",
      title:    `${Math.round(gpt4Share * 100)}% of your spend is on GPT-4`,
      description:
        `GPT-4 is your largest line item. A large share of those calls — based on industry benchmarks, around ${Math.round(GPT4_SWAP_RATIO * 100)}% — could run on GPT-4o-mini at a fraction of the cost. Estimated monthly savings: $${(modelWasteCents / 100).toFixed(0)}.`,
      potentialSavingsCents: modelWasteCents,
      metadata: { gpt4Share, gpt4SpendCents: gpt4Spend, swapRatio: GPT4_SWAP_RATIO },
      orderHint: 0,
    });
  }

  // ---- Cost spike detection ----------------------------------------------
  if (report.dailySpendCents.length > 0) {
    const dailyAvg = totalMonthlySpendCents / report.dailySpendCents.length;
    const spikes = report.dailySpendCents.filter((d) => d.costCents > dailyAvg * SPIKE_MULTIPLIER);
    if (spikes.length > 0) {
      const worst = spikes.reduce((a, b) => (a.costCents > b.costCents ? a : b));
      findings.push({
        type:     "cost_spike",
        severity: spikes.length > 3 ? "high" : "medium",
        title:    `${spikes.length} cost spike${spikes.length > 1 ? "s" : ""} detected`,
        description:
          `Your highest spike was on ${worst.date} at $${(worst.costCents / 100).toFixed(0)} — about ${(worst.costCents / dailyAvg).toFixed(1)}× your normal daily spend. Spikes often indicate a runaway agent, retry storm, or accidental load.`,
        potentialSavingsCents: null,
        metadata: { spikeDates: spikes.map((s) => s.date), avgDailyCents: dailyAvg },
        orderHint: 1,
      });
    }
  }

  // ---- Spend trend (week-over-week) --------------------------------------
  if (report.dailySpendCents.length >= 14) {
    const half = Math.floor(report.dailySpendCents.length / 2);
    const earlier = sum(report.dailySpendCents.slice(0, half).map((d) => d.costCents));
    const later   = sum(report.dailySpendCents.slice(half).map((d) => d.costCents));
    if (earlier > 0) {
      const change = (later - earlier) / earlier;
      if (Math.abs(change) > 0.20) {
        findings.push({
          type:     "spend_trend",
          severity: change > 0.5 ? "high" : "medium",
          title:    `Spend is ${change > 0 ? "up" : "down"} ${Math.round(Math.abs(change) * 100)}% vs the prior period`,
          description:
            change > 0
              ? `Your spend is accelerating. Worth knowing which agents or models drove the increase before it compounds.`
              : `Spend has dropped — confirm this matches an intentional change (paused agents, model swap) rather than a silent outage.`,
          potentialSavingsCents: null,
          metadata: { earlierCents: earlier, laterCents: later, pctChange: change },
          orderHint: 2,
        });
      }
    }
  }

  // ---- Under-use --------------------------------------------------------
  if (totalMonthlySpendCents > 0 && totalMonthlySpendCents < 1000) { // <$10 / period
    findings.push({
      type:     "underuse",
      severity: "info",
      title:    "Low usage detected",
      description:
        `Your AI spend over this period was under $${(totalMonthlySpendCents / 100).toFixed(2)}. Either you're just getting started, or your agents are sitting idle. Either way, fixing this earns more leverage than cost optimization.`,
      potentialSavingsCents: null,
      metadata: { totalSpendCents: totalMonthlySpendCents },
      orderHint: 3,
    });
  }

  // ---- Discovered agents = model buckets --------------------------------
  // Charlie's caveat: aggregate billing data can't resolve true per-agent
  // detail, so we present each model as its own "agent" with an
  // efficiency rating based on cost share + model class.
  const discoveredAgents: DiscoveredAgentSeed[] = byModel.map((m) => {
    const share = totalMonthlySpendCents > 0 ? m.costCents / totalMonthlySpendCents : 0;
    let efficiencyRating: DiscoveredAgentSeed["efficiencyRating"] = "unknown";
    if (/gpt-4o-mini|haiku|flash/i.test(m.model))      efficiencyRating = "good";
    else if (/gpt-4o(?!-mini)|sonnet|gemini-pro/i.test(m.model)) efficiencyRating = "fair";
    else if (/gpt-4(?!o)|opus/i.test(m.model) && share > 0.20) efficiencyRating = "poor";
    return {
      name:             `${m.model} workload`,
      model:            m.model,
      providerName:     report.provider,
      tasksCompleted:   m.calls,
      totalCostCents:   m.costCents,
      totalTokensIn:    m.tokensIn,
      totalTokensOut:   m.tokensOut,
      efficiencyRating,
      details:          { spendShare: share },
    };
  });

  // ---- Top-line metrics --------------------------------------------------
  const estimatedWasteCents = modelWasteCents; // currently only model_optimization contributes
  const efficiencyScore = totalMonthlySpendCents > 0
    ? Math.max(0, Math.min(100, 100 - (estimatedWasteCents / totalMonthlySpendCents) * 100))
    : 100;

  return {
    totalMonthlySpendCents,
    estimatedWasteCents,
    efficiencyScore,
    totalApiCalls: totalCalls,
    totalTokensIn: report.totalTokensIn,
    totalTokensOut: report.totalTokensOut,
    findings,
    discoveredAgents,
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

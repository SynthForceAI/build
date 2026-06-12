/**
 * Peer benchmarking for audit reports.
 *
 * Computes spend percentiles from anonymized aggregate data across all
 * SynthForce companies. Returns null (not enough data) when a cohort has
 * fewer than MIN_COHORT_SIZE companies — we never show unreliable numbers.
 *
 * All output is aggregate only; company identities are never surfaced.
 */
import { prisma } from "@/lib/db";

const MIN_COHORT_SIZE = 50;

// Spend tiers in cents/month (upper bound). Must stay sorted ascending.
const SPEND_TIERS = [
  { label: "<$1k/mo",    maxCents: 100_000 },
  { label: "$1–5k/mo",   maxCents: 500_000 },
  { label: "$5–20k/mo",  maxCents: 2_000_000 },
  { label: "$20k+/mo",   maxCents: Infinity },
];

function spendTierFor(cents: number): string {
  for (const t of SPEND_TIERS) {
    if (cents <= t.maxCents) return t.label;
  }
  return SPEND_TIERS[SPEND_TIERS.length - 1].label;
}

export type ModelBenchmark = {
  model: string;
  yourSharePct: number;
  peerMedianSharePct: number | null;
  peerP75SharePct: number | null;
  percentileRank: number | null; // 0-100: what % of peers spend *less* than you on this model
  recommendation: string | null;
};

export type BenchmarkResult = {
  cohortLabel: string;
  cohortSize: number;
  insufficient: boolean; // true when cohortSize < MIN_COHORT_SIZE
  models: ModelBenchmark[];
  summary: string | null;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Given this company's audit data, compute how they compare to peers.
 *
 * @param companyId   - excluded from the peer sample (don't compare to self)
 * @param spendCents  - this company's total spend in the period
 * @param byModel     - this company's per-model spend breakdown
 */
export async function computeBenchmark(
  companyId: string,
  spendCents: number,
  byModel: Array<{ model: string; costCents: number }>,
): Promise<BenchmarkResult> {
  const cohortLabel = spendTierFor(spendCents);

  // Pull completed audits from the same spend tier, excluding this company.
  // We only look at the most recent audit per company to avoid skewing.
  const peerAudits = await prisma.audit.findMany({
    where: {
      companyId: { not: companyId },
      status: "completed",
      totalMonthlySpendCents: { not: null },
    },
    orderBy: { createdAt: "desc" },
    distinct: ["companyId"],
    select: {
      companyId: true,
      totalMonthlySpendCents: true,
      reportData: true,
    },
  });

  // Filter to same spend tier.
  const cohortPeers = peerAudits.filter((a) => {
    const c = Number(a.totalMonthlySpendCents ?? 0);
    return spendTierFor(c) === cohortLabel;
  });

  const cohortSize = cohortPeers.length;

  if (cohortSize < MIN_COHORT_SIZE) {
    return {
      cohortLabel,
      cohortSize,
      insufficient: true,
      models: [],
      summary: null,
    };
  }

  // Aggregate per-model spend shares from peers.
  // reportData.byModel: Array<{ model, costCents, ... }>
  const peerModelShares = new Map<string, number[]>(); // model -> array of share %

  for (const peer of cohortPeers) {
    const rd = peer.reportData as { byModel?: Array<{ model: string; costCents: number }> } | null;
    const peerByModel = rd?.byModel ?? [];
    const peerTotal = peerByModel.reduce((s, m) => s + m.costCents, 0);
    if (peerTotal === 0) continue;
    for (const m of peerByModel) {
      const share = (m.costCents / peerTotal) * 100;
      const existing = peerModelShares.get(m.model) ?? [];
      existing.push(share);
      peerModelShares.set(m.model, existing);
    }
  }

  const totalSpend = byModel.reduce((s, m) => s + m.costCents, 0);

  const models: ModelBenchmark[] = byModel.map((m) => {
    const yourSharePct = totalSpend > 0 ? (m.costCents / totalSpend) * 100 : 0;
    const peerShares = (peerModelShares.get(m.model) ?? []).sort((a, b) => a - b);

    if (peerShares.length < 5) {
      return {
        model: m.model,
        yourSharePct,
        peerMedianSharePct: null,
        peerP75SharePct: null,
        percentileRank: null,
        recommendation: null,
      };
    }

    const median = percentile(peerShares, 50);
    const p75 = percentile(peerShares, 75);
    const rank = (peerShares.filter((s) => s < yourSharePct).length / peerShares.length) * 100;

    let recommendation: string | null = null;
    if (rank >= 75 && /gpt-4(?!o)|opus/i.test(m.model)) {
      const savings = Math.round((yourSharePct - median) / 100 * totalSpend);
      recommendation = savings > 500
        ? `You're in the top ${Math.round(100 - rank)}% for ${m.model} spend. Shifting ~${Math.round(yourSharePct - median)}% to a cheaper model could save ~$${(savings / 100).toFixed(0)}/mo.`
        : `You're spending more on ${m.model} than most peers. Consider routing lower-complexity tasks to a cheaper model.`;
    }

    return {
      model: m.model,
      yourSharePct,
      peerMedianSharePct: Math.round(median * 10) / 10,
      peerP75SharePct: Math.round(p75 * 10) / 10,
      percentileRank: Math.round(rank),
      recommendation,
    };
  });

  const outliers = models.filter((m) => m.percentileRank !== null && m.percentileRank >= 75 && m.recommendation);
  const summary = outliers.length > 0
    ? `Compared to similar-sized companies: ${outliers.map((m) => m.recommendation).join(" ")}`
    : `Your spend mix looks typical for ${cohortLabel} companies.`;

  return { cohortLabel, cohortSize, insufficient: false, models, summary };
}

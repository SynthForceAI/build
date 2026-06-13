/**
 * GET /api/companies/me/insights
 *
 * Org-level AI spend insights - the competitive edge over raw spend dashboards.
 * Layers recommendations + benchmarks + trend analysis on top of usage-summary data.
 *
 * Query params:
 *   days=30  (default 30, max 90)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { decimalToJson } from "@/lib/serialize";
import { priceFor } from "@/lib/providers/pricing";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelRow = {
  providerId: string | null;
  providerName: string;
  model: string;
  costCents: number;
  tokensIn: number;
  tokensOut: number;
  requests: number;
  pctOfTotal: number;
};

type Recommendation = {
  type: "model_downgrade" | "idle_model" | "cost_spike" | "high_output_ratio";
  title: string;
  detail: string;
  potentialSavingsCents: number;
  priority: "high" | "medium" | "low";
};

// ---------------------------------------------------------------------------
// Benchmark data - coarse industry medians by subscription tier.
// Replace with real cohort data once you have enough customers.
// ---------------------------------------------------------------------------
const MONTHLY_SPEND_BENCHMARKS: Record<string, number> = {
  free:       3_000_00,  // $3 000 / mo median for free tier companies
  starter:    8_000_00,  // $8 000
  team:      20_000_00,  // $20 000
  enterprise: 80_000_00, // $80 000
};

// Model downgrade pairs: if you're using the expensive one, consider the cheap one.
// Format: [expensiveModelPrefix, cheaperAlternativeId, approxAccuracyRetention]
const DOWNGRADE_CANDIDATES: [string, string, number][] = [
  ["claude-opus",   "claude-sonnet-4-6",         0.92],
  ["claude-sonnet", "claude-haiku-4-5-20251001",  0.88],
  ["gpt-4o",        "gpt-4o-mini",                0.90],
  ["gpt-4.1",       "gpt-4.1-mini",               0.91],
  ["o3",            "o4-mini",                    0.89],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function spendTrend(daily: { day: string; costCents: number }[]): {
  direction: "up" | "down" | "flat";
  pct: number;
  label: string;
} {
  if (daily.length < 4) return { direction: "flat", pct: 0, label: "Insufficient data" };

  const half = Math.floor(daily.length / 2);
  const firstHalf  = daily.slice(0, half).reduce((s, d) => s + d.costCents, 0);
  const secondHalf = daily.slice(half).reduce((s, d) => s + d.costCents, 0);

  if (firstHalf === 0) return { direction: "flat", pct: 0, label: "No prior spend" };

  const pct = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  if (Math.abs(pct) <= 5) return { direction: "flat", pct, label: "Spend is stable" };

  return pct > 0
    ? { direction: "up",   pct,      label: `Up ${pct}% vs prior period`   }
    : { direction: "down", pct: -pct, label: `Down ${-pct}% vs prior period` };
}

function buildRecommendations(models: ModelRow[], totalCostCents: number): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const row of models) {
    const modelLower = row.model.toLowerCase();

    // 1. Model downgrade suggestion
    for (const [expensivePrefix, cheaperModel, accuracy] of DOWNGRADE_CANDIDATES) {
      if (modelLower.startsWith(expensivePrefix) && !modelLower.includes("mini") && !modelLower.includes("haiku")) {
        const cheaperPrice = priceFor(row.providerName, cheaperModel);
        const currentPrice = priceFor(row.providerName, row.model);

        if (cheaperPrice && currentPrice && cheaperPrice.inputPerMillion < currentPrice.inputPerMillion) {
          const savingRatio = 1 - (cheaperPrice.inputPerMillion / currentPrice.inputPerMillion);
          const savingsCents = Math.round(row.costCents * savingRatio * 0.7); // conservative 70%

          if (savingsCents > 500) { // only surface if >$5 saving
            recs.push({
              type:  "model_downgrade",
              title: `Switch ${row.model} → ${cheaperModel}`,
              detail: `${cheaperModel} handles ~${Math.round(accuracy * 100)}% of use cases at ${Math.round(savingRatio * 100)}% lower cost. Est. saving on this model's spend.`,
              potentialSavingsCents: savingsCents,
              priority: savingsCents > 5_000_00 ? "high" : savingsCents > 1_000_00 ? "medium" : "low",
            });
          }
        }
        break;
      }
    }

    // 2. Idle model (< 10 requests in period but still incurring cost)
    if (row.requests > 0 && row.requests < 10 && row.costCents > 0) {
      recs.push({
        type:  "idle_model",
        title: `Low usage on ${row.model}`,
        detail: `Only ${row.requests} request${row.requests === 1 ? "" : "s"} in the period. Consider consolidating to your primary model.`,
        potentialSavingsCents: row.costCents,
        priority: "low",
      });
    }

    // 3. High output ratio (output tokens >> input tokens - possible verbosity issue)
    if (row.tokensIn > 0 && row.tokensOut / row.tokensIn > 3) {
      const currentPrice = priceFor(row.providerName, row.model);
      if (currentPrice) {
        const excessOutputCents = Math.round(
          ((row.tokensOut - row.tokensIn * 1.5) / 1_000_000) * currentPrice.outputPerMillion * 100 * 0.5,
        );
        if (excessOutputCents > 100) {
          recs.push({
            type:  "high_output_ratio",
            title: `High output ratio on ${row.model}`,
            detail: `Output tokens are ${Math.round(row.tokensOut / row.tokensIn)}× input tokens. Tighter system prompts with explicit output length limits could reduce cost.`,
            potentialSavingsCents: excessOutputCents,
            priority: "medium",
          });
        }
      }
    }
  }

  // Sort by potential savings desc, then priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) =>
    b.potentialSavingsCents - a.potentialSavingsCents ||
    priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  return recs.slice(0, 5); // cap at 5 recommendations
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();

    const daysParam = Number(req.nextUrl.searchParams.get("days") ?? "30");
    const days = Math.min(Math.max(1, isNaN(daysParam) ? 30 : daysParam), 90);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    // Also fetch prior period for trend comparison
    const priorStart = new Date(since);
    priorStart.setUTCDate(priorStart.getUTCDate() - days);

    const [company, totals, byModel, daily, priorTotals] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: user.companyId },
        select: { subscriptionTier: true },
      }),

      prisma.connectedAgentUsageLog.aggregate({
        where: { companyId: user.companyId, createdAt: { gte: since } },
        _sum: { costCents: true, tokensIn: true, tokensOut: true, numRequests: true },
      }),

      prisma.connectedAgentUsageLog.groupBy({
        by: ["providerId", "model"],
        where: { companyId: user.companyId, createdAt: { gte: since } },
        _sum: { costCents: true, tokensIn: true, tokensOut: true, numRequests: true },
        orderBy: { _sum: { costCents: "desc" } },
      }),

      prisma.$queryRaw<Array<{ day: Date; cost_cents: number }>>`
        SELECT
          DATE_TRUNC('day', created_at) AS day,
          COALESCE(SUM(cost_cents), 0)::float AS cost_cents
        FROM connected_agent_usage_logs
        WHERE company_id = ${user.companyId}::uuid
          AND created_at >= ${since}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day ASC
      `,

      prisma.connectedAgentUsageLog.aggregate({
        where: { companyId: user.companyId, createdAt: { gte: priorStart, lt: since } },
        _sum: { costCents: true },
      }),
    ]);

    // Resolve provider names
    const providerIds = [...new Set(byModel.map((r) => r.providerId).filter(Boolean))] as string[];
    const providers = providerIds.length
      ? await prisma.provider.findMany({
          where: { id: { in: providerIds } },
          select: { id: true, name: true, displayName: true },
        })
      : [];
    const providerMap = Object.fromEntries(providers.map((p) => [p.id, p]));

    const totalCostCents   = Number(decimalToJson(totals._sum.costCents ?? null) ?? 0);
    const priorCostCents   = Number(decimalToJson(priorTotals._sum.costCents ?? null) ?? 0);

    // Build model rows
    const models: ModelRow[] = byModel.map((row) => {
      const provider = row.providerId ? providerMap[row.providerId] : null;
      const rowCost  = Number(decimalToJson(row._sum.costCents ?? null) ?? 0);
      return {
        providerId:  row.providerId,
        providerName: provider?.name ?? "unknown",
        model:       row.model ?? "unknown",
        costCents:   rowCost,
        tokensIn:    row._sum.tokensIn    ?? 0,
        tokensOut:   row._sum.tokensOut   ?? 0,
        requests:    row._sum.numRequests ?? 0,
        pctOfTotal:  totalCostCents > 0 ? Math.round((rowCost / totalCostCents) * 100) : 0,
      };
    });

    // Trend
    const dailySeries = daily.map((d) => ({
      day:       d.day instanceof Date ? d.day.toISOString().slice(0, 10) : String(d.day),
      costCents: Number(d.cost_cents),
    }));
    const trend = spendTrend(dailySeries);

    // Benchmark
    const benchmarkMedian = MONTHLY_SPEND_BENCHMARKS[company.subscriptionTier] ?? MONTHLY_SPEND_BENCHMARKS.free;
    // Normalise both figures to 30-day equivalent for fair comparison
    const normalised      = Math.round((totalCostCents / days) * 30);
    const benchmarkRatio  = benchmarkMedian > 0 ? normalised / benchmarkMedian : null;

    let benchmarkLabel = "No benchmark data";
    let benchmarkPosition: "below" | "median" | "above" | "unknown" = "unknown";
    if (benchmarkRatio !== null) {
      if (benchmarkRatio < 0.8) {
        benchmarkLabel    = `Below median for ${company.subscriptionTier} tier`;
        benchmarkPosition = "below";
      } else if (benchmarkRatio <= 1.2) {
        benchmarkLabel    = `Near median for ${company.subscriptionTier} tier`;
        benchmarkPosition = "median";
      } else {
        benchmarkLabel    = `${Math.round(benchmarkRatio)}x median for ${company.subscriptionTier} tier. Review spend.`;
        benchmarkPosition = "above";
      }
    }

    // Recommendations
    const recommendations = buildRecommendations(models, totalCostCents);
    const totalPotentialSavings = recommendations.reduce((s, r) => s + r.potentialSavingsCents, 0);

    return NextResponse.json({
      periodDays: days,
      since: since.toISOString(),
      summary: {
        totalCostCents,
        totalTokensIn:  totals._sum.tokensIn    ?? 0,
        totalTokensOut: totals._sum.tokensOut   ?? 0,
        totalRequests:  totals._sum.numRequests ?? 0,
      },
      topModels: models.slice(0, 5).map((m) => ({
        model:       m.model,
        providerName: m.providerName,
        costCents:   m.costCents,
        pctOfTotal:  m.pctOfTotal,
        requests:    m.requests,
      })),
      trend: {
        ...trend,
        currentPeriodCents: totalCostCents,
        priorPeriodCents:   priorCostCents,
      },
      benchmark: {
        position:     benchmarkPosition,
        label:        benchmarkLabel,
        medianCents:  benchmarkMedian,
        yourCents30d: normalised,
        ratio:        benchmarkRatio !== null ? Math.round(benchmarkRatio * 100) / 100 : null,
      },
      recommendations,
      potentialSavingsCents: totalPotentialSavings,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * GET /api/companies/me/usage-summary
 *
 * Org-level spend breakdown from connected_agent_usage_logs (populated by
 * the provider polling sync job). Returns:
 *   - Total spend + tokens for requested period
 *   - Breakdown by provider → model (sorted by cost desc)
 *   - Daily spend time-series for trend charting
 *
 * Query params:
 *   days=30  (default 30, max 90)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { decimalToJson } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();

    const daysParam = Number(req.nextUrl.searchParams.get("days") ?? "30");
    const days = Math.min(Math.max(1, isNaN(daysParam) ? 30 : daysParam), 90);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    const [totals, byProviderModel, daily] = await Promise.all([
      // ── Overall totals ────────────────────────────────────────────────
      prisma.connectedAgentUsageLog.aggregate({
        where: { companyId: user.companyId, createdAt: { gte: since } },
        _sum: {
          costCents:   true,
          tokensIn:    true,
          tokensOut:   true,
          numRequests: true,
        },
      }),

      // ── Breakdown by provider + model ─────────────────────────────────
      // Prisma doesn't support groupBy on a nullable relation field directly,
      // so we pull the log rows with provider name via relation and group in JS.
      prisma.connectedAgentUsageLog.groupBy({
        by: ["providerId", "model"],
        where: { companyId: user.companyId, createdAt: { gte: since } },
        _sum: {
          costCents:   true,
          tokensIn:    true,
          tokensOut:   true,
          numRequests: true,
        },
        orderBy: { _sum: { costCents: "desc" } },
      }),

      // ── Daily time-series ─────────────────────────────────────────────
      // Aggregate per calendar day in the DB using raw query for date truncation.
      prisma.$queryRaw<Array<{ day: Date; cost_cents: number; tokens_in: number; tokens_out: number }>>`
        SELECT
          DATE_TRUNC('day', created_at) AS day,
          COALESCE(SUM(cost_cents), 0)::float  AS cost_cents,
          COALESCE(SUM(tokens_in), 0)::bigint  AS tokens_in,
          COALESCE(SUM(tokens_out), 0)::bigint AS tokens_out
        FROM connected_agent_usage_logs
        WHERE company_id = ${user.companyId}::uuid
          AND created_at >= ${since}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day ASC
      `,
    ]);

    // Resolve provider names for the breakdown rows
    const providerIds = [...new Set(byProviderModel.map((r) => r.providerId).filter(Boolean))] as string[];
    const providers = providerIds.length
      ? await prisma.provider.findMany({
          where: { id: { in: providerIds } },
          select: { id: true, name: true, displayName: true },
        })
      : [];
    const providerMap = Object.fromEntries(providers.map((p) => [p.id, p]));

    const totalCostCents = decimalToJson(totals._sum.costCents ?? null) ?? 0;

    const breakdown = byProviderModel.map((row) => {
      const provider = row.providerId ? providerMap[row.providerId] : null;
      const rowCost  = decimalToJson(row._sum.costCents ?? null) ?? 0;
      const pct = typeof totalCostCents === "number" && totalCostCents > 0
        ? Math.round((Number(rowCost) / totalCostCents) * 100)
        : 0;

      return {
        providerId:   row.providerId,
        providerName: provider?.name        ?? "unknown",
        providerDisplayName: provider?.displayName ?? "Unknown",
        model:        row.model             ?? "unknown",
        costCents:    rowCost,
        tokensIn:     row._sum.tokensIn     ?? 0,
        tokensOut:    row._sum.tokensOut    ?? 0,
        requests:     row._sum.numRequests  ?? 0,
        pctOfTotal:   pct,
      };
    });

    return NextResponse.json({
      periodDays: days,
      since: since.toISOString(),
      totals: {
        costCents:   totalCostCents,
        tokensIn:    totals._sum.tokensIn    ?? 0,
        tokensOut:   totals._sum.tokensOut   ?? 0,
        requests:    totals._sum.numRequests ?? 0,
      },
      breakdown,
      daily: daily.map((d) => ({
        day:       d.day instanceof Date ? d.day.toISOString().slice(0, 10) : String(d.day),
        costCents: Number(d.cost_cents),
        tokensIn:  Number(d.tokens_in),
        tokensOut: Number(d.tokens_out),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

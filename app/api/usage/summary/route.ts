/**
 * GET /api/usage/summary
 *
 * Dashboard summary card data: month-to-date spend, active agents,
 * total tokens, top-N agents by spend.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { bigintToJson, decimalToJson } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireUser();
    const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);

    const [agentCounts, mtdAgg, topAgents] = await Promise.all([
      prisma.agent.groupBy({
        by: ["status"],
        where: { companyId: user.companyId },
        _count: { status: true },
      }),
      prisma.usageLog.aggregate({
        where: { companyId: user.companyId, createdAt: { gte: start } },
        _sum: { costCents: true, tokensIn: true, tokensOut: true },
        _count: { _all: true },
      }),
      prisma.agent.findMany({
        where: { companyId: user.companyId },
        orderBy: { currentMonthSpendCents: "desc" },
        take: 5,
        select: {
          id: true, name: true,
          currentMonthSpendCents: true,
          monthlyBudgetCents: true,
          status: true,
        },
      }),
    ]);

    const statusMap = Object.fromEntries(
      agentCounts.map((r) => [r.status, r._count.status]),
    );

    return NextResponse.json({
      monthToDate: {
        spendCents: decimalToJson(mtdAgg._sum.costCents ?? null),
        tokensIn:   mtdAgg._sum.tokensIn  ?? 0,
        tokensOut:  mtdAgg._sum.tokensOut ?? 0,
        requests:   mtdAgg._count._all,
      },
      agentCounts: {
        active:      statusMap.active      ?? 0,
        paused:      statusMap.paused      ?? 0,
        deactivated: statusMap.deactivated ?? 0,
        flagged:     statusMap.flagged     ?? 0,
        total:
          (statusMap.active ?? 0) + (statusMap.paused ?? 0) +
          (statusMap.deactivated ?? 0) + (statusMap.flagged ?? 0),
      },
      topAgentsBySpend: topAgents.map((a) => ({
        ...a,
        currentMonthSpendCents: bigintToJson(a.currentMonthSpendCents),
        monthlyBudgetCents:     bigintToJson(a.monthlyBudgetCents),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * GET /api/agents/usage?timeframe=24h|7d|30d
 *
 * Returns proxy usage_logs aggregated per agent for the requested window.
 * Used by the agent detail page and any dashboard that reads proxy data.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { decimalToJson } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const TIMEFRAME_HOURS: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const { searchParams } = new URL(request.url);
    const tf = searchParams.get("timeframe") ?? "24h";
    const hours = TIMEFRAME_HOURS[tf] ?? 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [logs, agents] = await Promise.all([
      prisma.usageLog.findMany({
        where: { companyId: user.companyId, createdAt: { gte: since } },
        select: {
          agentId:   true,
          tokensIn:  true,
          tokensOut: true,
          costCents: true,
        },
      }),
      prisma.agent.findMany({
        where: { companyId: user.companyId },
        select: { id: true, name: true, status: true },
      }),
    ]);

    // Aggregate per agent
    const byAgent: Record<string, { tokensIn: number; tokensOut: number; costCents: number; requests: number }> = {};
    let totalCostCents = 0;

    for (const row of logs) {
      if (!byAgent[row.agentId]) {
        byAgent[row.agentId] = { tokensIn: 0, tokensOut: 0, costCents: 0, requests: 0 };
      }
      const cost = Number(decimalToJson(row.costCents) ?? 0);
      byAgent[row.agentId].tokensIn  += row.tokensIn;
      byAgent[row.agentId].tokensOut += row.tokensOut;
      byAgent[row.agentId].costCents += cost;
      byAgent[row.agentId].requests  += 1;
      totalCostCents += cost;
    }

    const result = agents.map((a) => ({
      id:       a.id,
      name:     a.name,
      status:   a.status,
      ...(byAgent[a.id] ?? { tokensIn: 0, tokensOut: 0, costCents: 0, requests: 0 }),
    }));

    return NextResponse.json({ agents: result, totalCostCents, timeframe: tf });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * GET /api/usage-logs
 *
 * Filterable audit log of all proxy requests for the company.
 *
 * Query params:
 *   agentId    - filter to a specific agent UUID
 *   wasBlocked - "true" | "false"  (omit = all)
 *   startDate  - ISO date string (e.g. "2026-06-01")
 *   limit      - max rows, default 100, max 500
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { decimalToJson } from "@/lib/serialize";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const { searchParams } = new URL(request.url);

    const agentId    = searchParams.get("agentId") ?? undefined;
    const blockedStr = searchParams.get("wasBlocked");
    const startDate  = searchParams.get("startDate") ?? undefined;
    const limit      = Math.min(Number(searchParams.get("limit") ?? 100), 500);

    const where: Prisma.UsageLogWhereInput = {
      companyId: user.companyId,
      ...(agentId    ? { agentId }                                 : {}),
      ...(blockedStr !== null ? { wasBlocked: blockedStr === "true" } : {}),
      ...(startDate  ? { createdAt: { gte: new Date(startDate) } } : {}),
    };

    const rows = await prisma.usageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id:        true,
        agentId:   true,
        agent:     { select: { name: true } },
        provider:  { select: { name: true, displayName: true } },
        tokensIn:  true,
        tokensOut: true,
        costCents: true,
        statusCode: true,
        wasBlocked: true,
        policyId:  true,
        metadata:  true,
        createdAt: true,
      },
    });

    const logs = rows.map((r) => ({
      id:           r.id,
      agentId:      r.agentId,
      agentName:    r.agent.name,
      providerName: r.provider.displayName,
      model:        (r.metadata as Record<string, unknown>)?.model ?? null,
      tokensIn:     r.tokensIn,
      tokensOut:    r.tokensOut,
      costCents:    decimalToJson(r.costCents),
      statusCode:   r.statusCode,
      wasBlocked:   r.wasBlocked,
      policyId:     r.policyId,
      createdAt:    r.createdAt,
    }));

    return NextResponse.json({ logs, total: logs.length });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * GET   /api/agents       — list company agents, optional filters
 * POST  /api/agents       — create agent (owner/admin)
 *
 * Query params (GET):
 *   ?status=active|paused|deactivated|flagged
 *   ?departmentId=<uuid>
 *   ?limit=<int, default 50, max 200>
 *   ?cursor=<agent id, exclusive>
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { AgentCreateSchema, AgentStatusEnum, Uuid } from "@/lib/validators";
import { bigintToJson } from "@/lib/serialize";

export const dynamic = "force-dynamic";

function serializeAgent<T extends {
  monthlyBudgetCents: bigint;
  currentMonthSpendCents: bigint;
  totalLifetimeSpendCents: bigint;
  totalTokensIn: bigint;
  totalTokensOut: bigint;
}>(a: T) {
  return {
    ...a,
    monthlyBudgetCents:      bigintToJson(a.monthlyBudgetCents),
    currentMonthSpendCents:  bigintToJson(a.currentMonthSpendCents),
    totalLifetimeSpendCents: bigintToJson(a.totalLifetimeSpendCents),
    totalTokensIn:           bigintToJson(a.totalTokensIn),
    totalTokensOut:          bigintToJson(a.totalTokensOut),
  };
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const deptParam   = url.searchParams.get("departmentId");
    const limit       = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10), 1), 200);
    const cursor      = url.searchParams.get("cursor") ?? undefined;

    const where: Record<string, unknown> = { companyId: user.companyId };
    if (statusParam) where.status = AgentStatusEnum.parse(statusParam);
    if (deptParam)   where.departmentId = Uuid.parse(deptParam);

    const rows = await prisma.agent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        department: { select: { id: true, name: true } },
        provider:   { select: { id: true, name: true, displayName: true } },
        model:      { select: { id: true, modelId: true, displayName: true } },
      },
    });

    const hasMore   = rows.length > limit;
    const trimmed   = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

    return NextResponse.json({
      agents:     trimmed.map(serializeAgent),
      nextCursor,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin", "member");
    const data = AgentCreateSchema.parse(await request.json());

    // Cross-tenant safety: every referenced FK must belong to the same company.
    if (data.departmentId) {
      const ok = await prisma.department.findFirst({
        where: { id: data.departmentId, companyId: user.companyId },
        select: { id: true },
      });
      if (!ok) return NextResponse.json({ error: { code: "department_not_found" } }, { status: 400 });
    }
    if (data.apiKeyId) {
      const ok = await prisma.apiKey.findFirst({
        where: { id: data.apiKeyId, companyId: user.companyId },
        select: { id: true },
      });
      if (!ok) return NextResponse.json({ error: { code: "api_key_not_found" } }, { status: 400 });
    }
    if (data.managedBy) {
      const ok = await prisma.user.findFirst({
        where: { id: data.managedBy, companyId: user.companyId },
        select: { id: true },
      });
      if (!ok) return NextResponse.json({ error: { code: "managed_by_not_in_company" } }, { status: 400 });
    }

    const agent = await prisma.agent.create({
      data: {
        companyId:          user.companyId,
        name:               data.name,
        description:        data.description,
        departmentId:       data.departmentId,
        providerId:         data.providerId,
        modelId:            data.modelId,
        apiKeyId:           data.apiKeyId,
        monthlyBudgetCents: data.monthlyBudgetCents !== undefined ? BigInt(data.monthlyBudgetCents) : undefined,
        logFullContent:     data.logFullContent,
        managedBy:          data.managedBy,
        metadata:           data.metadata as object | undefined,
      },
    });
    return NextResponse.json({ agent: serializeAgent(agent) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * GET    /api/agents/:id  — agent detail
 * PATCH  /api/agents/:id  — update (owner/admin/member)
 * DELETE /api/agents/:id  — delete (owner/admin)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { AgentUpdateSchema, Uuid } from "@/lib/validators";
import { bigintToJson } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadAgent(id: string, companyId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id, companyId },
    include: {
      department: { select: { id: true, name: true } },
      provider:   { select: { id: true, name: true, displayName: true } },
      model:      { select: { id: true, modelId: true, displayName: true } },
      manager:    { select: { id: true, email: true, name: true } },
    },
  });
  if (!agent) throw new ApiError(404, "agent_not_found");
  return agent;
}

function serialize(a: Awaited<ReturnType<typeof loadAgent>>) {
  return {
    ...a,
    monthlyBudgetCents:      bigintToJson(a.monthlyBudgetCents),
    currentMonthSpendCents:  bigintToJson(a.currentMonthSpendCents),
    totalLifetimeSpendCents: bigintToJson(a.totalLifetimeSpendCents),
    totalTokensIn:           bigintToJson(a.totalTokensIn),
    totalTokensOut:          bigintToJson(a.totalTokensOut),
  };
}

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    Uuid.parse(id);
    const agent = await loadAgent(id, user.companyId);
    return NextResponse.json({ agent: serialize(agent) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin", "member");
    const { id } = await params;
    Uuid.parse(id);
    await loadAgent(id, user.companyId);
    const data = AgentUpdateSchema.parse(await request.json());

    const updated = await prisma.agent.update({
      where: { id },
      data: {
        ...data,
        monthlyBudgetCents:
          data.monthlyBudgetCents !== undefined ? BigInt(data.monthlyBudgetCents) : undefined,
        metadata: data.metadata as object | undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        provider:   { select: { id: true, name: true, displayName: true } },
        model:      { select: { id: true, modelId: true, displayName: true } },
        manager:    { select: { id: true, email: true, name: true } },
      },
    });
    return NextResponse.json({ agent: serialize(updated) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin");
    const { id } = await params;
    Uuid.parse(id);
    await loadAgent(id, user.companyId);
    await prisma.agent.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}

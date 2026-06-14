/**
 * GET /api/agents/:id/virtual-key — return the active virtual key for an agent.
 * Only the owning company can access it.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { Uuid } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    Uuid.parse(id);

    const agent = await prisma.agent.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true },
    });
    if (!agent) throw new ApiError(404, "agent_not_found");

    const vk = await prisma.agentVirtualKey.findFirst({
      where: { agentId: id, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { virtualKey: true, createdAt: true, rotatedAt: true, lastUsedAt: true },
    });

    if (!vk) throw new ApiError(404, "no_virtual_key", { detail: "No active virtual key for this agent." });

    return NextResponse.json({
      virtualKey:  vk.virtualKey,
      createdAt:   vk.createdAt,
      rotatedAt:   vk.rotatedAt,
      lastUsedAt:  vk.lastUsedAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

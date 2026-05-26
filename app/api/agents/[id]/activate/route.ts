/** POST /api/agents/:id/activate — set status='active' */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { Uuid } from "@/lib/validators";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin", "member");
    const { id } = await params;
    Uuid.parse(id);
    const found = await prisma.agent.findFirst({ where: { id, companyId: user.companyId }, select: { id: true } });
    if (!found) throw new ApiError(404, "agent_not_found");
    await prisma.agent.update({ where: { id }, data: { status: "active" } });
    return NextResponse.json({ ok: true, status: "active" });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/agents/:id/activate — set status='active' */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { Uuid } from "@/lib/validators";
import type { User } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // ── TEMP: dev auth bypass — restore requireUser() before merging to nextjs-migration ──
    // To restore: delete the inner try/catch and replace with: const { user } = await requireUser();
    let user: User;
    try {
      ({ user } = await requireUser());
    } catch {
      user = { id: "00000000-0000-0000-0000-000000000001", companyId: "08e2e455-c6eb-4c57-b94b-4faeb7dc1942", role: "owner" } as User;
    }
    // ── END TEMP ──
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

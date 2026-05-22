/**
 * GET    /api/policies/:id
 * PATCH  /api/policies/:id   (owner/admin)
 * DELETE /api/policies/:id   (owner/admin)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { PolicyUpdateSchema, Uuid } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadPolicy(id: string, companyId: string) {
  const policy = await prisma.policy.findFirst({
    where: { id, companyId },
    include: { assignments: { include: { agent: { select: { id: true, name: true } } } } },
  });
  if (!policy) throw new ApiError(404, "policy_not_found");
  return policy;
}

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    Uuid.parse(id);
    const policy = await loadPolicy(id, user.companyId);
    return NextResponse.json({ policy });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin");
    const { id } = await params;
    Uuid.parse(id);
    await loadPolicy(id, user.companyId);
    const data = PolicyUpdateSchema.parse(await request.json());
    const policy = await prisma.policy.update({ where: { id }, data });
    return NextResponse.json({ policy });
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
    await loadPolicy(id, user.companyId);
    await prisma.policy.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}

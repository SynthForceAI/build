/**
 * GET   /api/policies  — list company policies
 * POST  /api/policies  — create policy (owner/admin)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { PolicyCreateSchema } from "@/lib/validators";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireUser();
    const policies = await prisma.policy.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { assignments: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ policies });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin");
    const data = PolicyCreateSchema.parse(await request.json());

    // If scope is department-bound, ensure the department belongs to us.
    if (data.scopeDepartmentId) {
      const ok = await prisma.department.findFirst({
        where: { id: data.scopeDepartmentId, companyId: user.companyId },
        select: { id: true },
      });
      if (!ok) return NextResponse.json({ error: { code: "department_not_found" } }, { status: 400 });
    }

    const policy = await prisma.policy.create({
      data: {
        companyId:         user.companyId,
        name:              data.name,
        description:       data.description,
        ruleDefinition:    data.ruleDefinition,
        severity:          data.severity ?? "warning",
        scope:             data.scope ?? "global",
        scopeDepartmentId: data.scopeDepartmentId,
        isActive:          data.isActive ?? true,
        createdBy:         user.id,
      },
    });
    return NextResponse.json({ policy }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

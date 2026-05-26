/**
 * GET    /api/departments/:id
 * PATCH  /api/departments/:id   (owner/admin)
 * DELETE /api/departments/:id   (owner/admin) — sets agents.department_id to null
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { DepartmentUpdateSchema, Uuid } from "@/lib/validators";
import { bigintToJson } from "@/lib/serialize";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadDepartment(id: string, companyId: string) {
  const dept = await prisma.department.findFirst({ where: { id, companyId } });
  if (!dept) throw new ApiError(404, "department_not_found");
  return dept;
}

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    Uuid.parse(id);
    const dept = await loadDepartment(id, user.companyId);
    return NextResponse.json({
      department: { ...dept, monthlyBudgetCents: bigintToJson(dept.monthlyBudgetCents) },
    });
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
    await loadDepartment(id, user.companyId);
    const data = DepartmentUpdateSchema.parse(await request.json());
    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...data,
        monthlyBudgetCents:
          data.monthlyBudgetCents !== undefined ? BigInt(data.monthlyBudgetCents) : undefined,
      },
    });
    return NextResponse.json({
      department: { ...updated, monthlyBudgetCents: bigintToJson(updated.monthlyBudgetCents) },
    });
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
    await loadDepartment(id, user.companyId);
    await prisma.department.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}

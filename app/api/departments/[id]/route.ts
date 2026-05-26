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
import type { User } from "@prisma/client";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadDepartment(id: string, companyId: string) {
  const dept = await prisma.department.findFirst({ where: { id, companyId } });
  if (!dept) throw new ApiError(404, "department_not_found");
  return dept;
}

export async function GET(_request: Request, { params }: Ctx) {
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
    // ── TEMP: dev auth bypass — restore requireUser() before merging to nextjs-migration ──
    // To restore: delete the inner try/catch and replace with: const { user } = await requireUser();
    let user: User;
    try {
      ({ user } = await requireUser());
    } catch {
      user = { id: "00000000-0000-0000-0000-000000000001", companyId: "08e2e455-c6eb-4c57-b94b-4faeb7dc1942", role: "owner" } as User;
    }
    // ── END TEMP ──
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
    // ── TEMP: dev auth bypass — restore requireUser() before merging to nextjs-migration ──
    // To restore: delete the inner try/catch and replace with: const { user } = await requireUser();
    let user: User;
    try {
      ({ user } = await requireUser());
    } catch {
      user = { id: "00000000-0000-0000-0000-000000000001", companyId: "08e2e455-c6eb-4c57-b94b-4faeb7dc1942", role: "owner" } as User;
    }
    // ── END TEMP ──
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

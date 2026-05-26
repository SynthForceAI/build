/**
 * GET   /api/departments  — list company departments
 * POST  /api/departments  — create department (owner/admin)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { DepartmentCreateSchema } from "@/lib/validators";
import { bigintToJson } from "@/lib/serialize";
import type { User } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
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
    const rows = await prisma.department.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { agents: true } } },
    });
    return NextResponse.json({
      departments: rows.map((d) => ({
        ...d,
        monthlyBudgetCents: bigintToJson(d.monthlyBudgetCents),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
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
    const data = DepartmentCreateSchema.parse(await request.json());
    const dept = await prisma.department.create({
      data: {
        companyId:          user.companyId,
        name:               data.name,
        description:        data.description,
        monthlyBudgetCents: BigInt(data.monthlyBudgetCents ?? 0),
      },
    });
    return NextResponse.json(
      { department: { ...dept, monthlyBudgetCents: bigintToJson(dept.monthlyBudgetCents) } },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

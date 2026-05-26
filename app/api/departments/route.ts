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
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireUser();
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
    const { user } = await requireUser();
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

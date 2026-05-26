/**
 * GET   /api/policies  — list company policies
 * POST  /api/policies  — create policy (owner/admin)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { PolicyCreateSchema } from "@/lib/validators";
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

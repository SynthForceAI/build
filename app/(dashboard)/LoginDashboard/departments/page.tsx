/*
 * Departments page
 */

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { DepartmentsClient, type DepartmentRow } from "@/components/ui/departments-client";

async function fetchDepartments(companyId: string): Promise<DepartmentRow[]> {
  const rows = await prisma.department.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { agents: true } },
      agents: { select: { currentMonthSpendCents: true } },
    },
  });

  return rows.map((d) => ({
    id:          d.id,
    name:        d.name,
    description: d.description,
    agentCount:  d._count.agents,
    // Sum agent spend across the department (BigInt → Number)
    spendCents:  d.agents.reduce((sum, a) => sum + Number(a.currentMonthSpendCents), 0),
    budgetCents: Number(d.monthlyBudgetCents),
  }));
}

export default async function DepartmentsPage() {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/");
    throw err;
  }

  const departments = await fetchDepartments(companyId).catch(() => [] as DepartmentRow[]);

  return <DepartmentsClient departments={departments} />;
}

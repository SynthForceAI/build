/*
 * Departments page
 */

import { requireUser } from "@/lib/auth";
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
  // ── TEMP: silent auth bypass — restore redirect before merging to nextjs-migration ──
  // Same pattern as app/(dashboard)/dashboard/page.tsx. When restoring:
  //   catch (err) {
  //     if (err instanceof ApiError && err.status === 401) redirect("/");
  //     throw err;
  //   }
  // and add: import { redirect } from "next/navigation"; import { ApiError } ...
  // ── END TEMP ──────────────────────────────────────────────────────────────────────
  let companyId: string | null = null;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch {
    companyId = "08e2e455-c6eb-4c57-b94b-4faeb7dc1942"; // TEMP: swallows 401 during dev
  }

  const departments = companyId
    ? await fetchDepartments(companyId).catch(() => [] as DepartmentRow[])
    : [];

  return <DepartmentsClient departments={departments} />;
}

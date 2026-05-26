/*
 * Agent Policies Page
*/

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { PoliciesClient } from "@/components/ui/policies-client";

async function fetchData(companyId: string) {
  const [rows, depts] = await Promise.all([
    prisma.policy.findMany({
      where: { companyId },
      include: { scopeDepartment: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
    }),
  ]);

  const policies = rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    department: p.scopeDepartment?.name ?? null,
    departmentId: p.scopeDepartmentId ?? null,
    severity: p.severity,
    scope: p.scope,
  }));

  return { policies, departments: depts };
}

export default async function PolicyPage() {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/");
    throw err;
  }

  const { policies, departments } = await fetchData(companyId).catch(() => ({ policies: [], departments: [] }));

  return <PoliciesClient policies={policies} departments={departments} />;
}
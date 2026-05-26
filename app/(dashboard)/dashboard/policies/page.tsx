/*
 * Agent Policies Page
*/

import { requireUser } from "@/lib/auth";
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

  const { policies, departments } = companyId
    ? await fetchData(companyId).catch(() => ({ policies: [], departments: [] }))
    : { policies: [], departments: [] };

  return <PoliciesClient policies={policies} departments={departments} />;
}
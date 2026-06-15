import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { AuditLogClient } from "@/components/ui/audit-log-client";

export default async function AuditLogPage() {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const audits = await prisma.audit.findMany({
    where: { companyId, status: "completed" },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      completedAt: true,
      dataPeriodStart: true,
      dataPeriodEnd: true,
      totalMonthlySpendCents: true,
      estimatedWasteCents: true,
      efficiencyScore: true,
      apiKey: {
        select: {
          provider: { select: { name: true, displayName: true } },
        },
      },
    },
  }).catch(() => []);

  const auditRows = audits.map((a) => ({
    id: a.id,
    completedAt: a.completedAt?.toISOString() ?? "",
    periodStart: a.dataPeriodStart?.toISOString() ?? null,
    periodEnd: a.dataPeriodEnd?.toISOString() ?? null,
    totalSpendCents: a.totalMonthlySpendCents ? Number(a.totalMonthlySpendCents) : null,
    estimatedWasteCents: a.estimatedWasteCents ? Number(a.estimatedWasteCents) : null,
    efficiencyScore: a.efficiencyScore ? Math.round(Number(a.efficiencyScore)) : null,
    providerName: a.apiKey?.provider?.name ?? "unknown",
    providerDisplayName: a.apiKey?.provider?.displayName ?? "Unknown",
  }));

  // Unique providers across all audits for the filter dropdown
  const providers = Array.from(
    new Map(auditRows.map((a) => [a.providerName, a.providerDisplayName])).entries()
  ).map(([name, displayName]) => ({ name, displayName }));

  return (
    <Suspense>
      <AuditLogClient audits={auditRows} providers={providers} />
    </Suspense>
  );
}

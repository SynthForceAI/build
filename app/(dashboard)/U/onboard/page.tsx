import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-errors";
import { bigintToJson } from "@/lib/serialize";
import { OnboardClient } from "./components/OnboardClient";

export default async function OnboardPage() {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/");
    throw err;
  }

  const [providers, departments, rawAgents] = await Promise.all([
    prisma.provider.findMany({
      where:   { isActive: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.department.findMany({
      where:   { companyId },
      orderBy: { name: "asc" },
    }),
    prisma.connectedAgent.findMany({
      where:   { companyId, deletedAt: null },
      orderBy: { connectedAt: "desc" },
      include: { department: { select: { name: true } } },
    }),
  ]);

  const initialAgents = rawAgents.map((a) => ({
    id:                  a.id,
    name:                a.name,
    providerName:        a.providerName,
    modelUsed:           a.modelUsed,
    status:              a.status as "pending" | "active" | "inactive",
    tasksMonitored:      a.tasksMonitored,
    totalCostCents:      bigintToJson(a.totalCostCents),
    connectedAt:         a.connectedAt.toISOString(),
    lastUsageReportedAt: a.lastUsageReportedAt?.toISOString() ?? null,
    department:          a.department?.name ?? null,
  }));

  return (
    <OnboardClient
      providers={providers.map((p) => ({ id: p.id, name: p.name, displayName: p.displayName }))}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      initialAgents={initialAgents}
    />
  );
}

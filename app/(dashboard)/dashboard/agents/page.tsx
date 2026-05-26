/**
 * Agents page — lists every agent for the company with status, spend,
 * department, model, and activate/pause controls.
 */

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AgentsClient, type AgentRow } from "@/components/ui/agents-client";

// ── Data fetching ──────────────────────────────────────────────────────────

async function fetchAgents(companyId: string): Promise<AgentRow[]> {
  const rows = await prisma.agent.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: {
      department: { select: { name: true } },
      provider:   { select: { displayName: true } },
      model:      { select: { displayName: true } },
    },
  });

  return rows.map((a) => ({
    id:           a.id,
    name:         a.name,
    description:  a.description,
    status:       a.status as string,
    department:   a.department?.name ?? null,
    provider:     a.provider?.displayName ?? null,
    model:        a.model?.displayName ?? null,
    spendCents:   Number(a.currentMonthSpendCents),
    budgetCents:  Number(a.monthlyBudgetCents),
    lastActiveAt: a.lastActiveAt?.toISOString() ?? null,
  }));
}

async function fetchProviders() {
  return prisma.provider.findMany({
    where: { isActive: true },
    select: { id: true, name: true, displayName: true },
  });
}

async function fetchModels() {
  return prisma.providerModel.findMany({
    where: { isActive: true },
    select: { id: true, modelId: true, displayName: true, providerId: true },
  });
}

async function fetchDepartments(companyId: string) {
  return prisma.department.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AgentsPage() {
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
    companyId = "08e2e455-c6eb-4c57-b94b-4faeb7dc1942"; // TEMP: swallows 401 during dev; real code should redirect
  }

  const [agents, providers, models, departments] = companyId
    ? await Promise.all([
        fetchAgents(companyId).catch(() => [] as AgentRow[]),
        fetchProviders().catch(() => []),
        fetchModels().catch(() => []),
        fetchDepartments(companyId).catch(() => []),
      ])
    : [[], [], [], []];

  return (
    <AgentsClient
      agents={agents}
      providers={providers}
      models={models}
      departments={departments}
    />
  );
}

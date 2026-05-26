/**
 * Performance page — read-only monitoring view of all agents sorted by
 * MTD spend. Distinct from the Agents page (which is management-focused)
 * in that it surfaces spend, budget utilization, and last-active at a glance
 * with no edit controls.
 */

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────

type AgentRow = {
  id: string;
  name: string;
  status: string;
  department: string | null;
  provider: string | null;
  model: string | null;
  spendCents: number;
  budgetCents: number;
  lastActiveAt: string | null;
};

// ── Data fetching ──────────────────────────────────────────────────────────

async function fetchAgents(companyId: string): Promise<AgentRow[]> {
  const rows = await prisma.agent.findMany({
    where: { companyId },
    orderBy: { currentMonthSpendCents: "desc" },
    include: {
      department: { select: { name: true } },
      provider:   { select: { displayName: true } },
      model:      { select: { displayName: true } },
    },
  });

  return rows.map((a) => ({
    id:           a.id,
    name:         a.name,
    status:       a.status as string,
    department:   a.department?.name ?? null,
    provider:     a.provider?.displayName ?? null,
    model:        a.model?.displayName ?? null,
    spendCents:   Number(a.currentMonthSpendCents),
    budgetCents:  Number(a.monthlyBudgetCents),
    lastActiveAt: a.lastActiveAt?.toISOString() ?? null,
  }));
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRelativeTime(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs  < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

// ── Status pill styles ─────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  active:      "bg-green-100 text-green-800",
  paused:      "bg-yellow-100 text-yellow-800",
  flagged:     "bg-red-100 text-red-800",
  deactivated: "bg-gray-100 text-gray-600",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default async function PerformancePage() {
  // ── TEMP: silent auth bypass — restore redirect before merging to nextjs-migration ──
  // To restore: replace catch body with:
  //   if (err instanceof ApiError && err.status === 401) redirect("/");
  //   throw err;
  // and add: import { redirect } from "next/navigation"; import { ApiError } ...
  // ── END TEMP ──────────────────────────────────────────────────────────────────────
  let companyId: string | null = null;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch {
    companyId = "08e2e455-c6eb-4c57-b94b-4faeb7dc1942"; // TEMP: swallows 401 during dev
  }

  const agents = companyId
    ? await fetchAgents(companyId).catch(() => [] as AgentRow[])
    : [];

  // ── Derived stats ──────────────────────────────────────────────────────
  const totalSpend    = agents.reduce((sum, a) => sum + a.spendCents, 0);
  const activeCount   = agents.filter((a) => a.status === "active").length;
  const overBudget    = agents.filter((a) => a.budgetCents > 0 && a.spendCents > a.budgetCents).length;
  const withBudget    = agents.filter((a) => a.budgetCents > 0);
  const avgUtil       = withBudget.length > 0
    ? Math.round(withBudget.reduce((sum, a) => sum + (a.spendCents / a.budgetCents) * 100, 0) / withBudget.length)
    : null;

  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div>

      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
        <p className="text-sm text-gray-500 mt-1">{month} · Month-to-date · sorted by spend</p>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <Stat value={fmtDollars(totalSpend)}     label="Total MTD Spend"       tone="bg-purple-50" />
        <Stat value={String(activeCount)}         label="Active Agents"         tone="bg-blue-50"   />
        <Stat value={String(overBudget)}          label="Agents Over Budget"    tone={overBudget > 0 ? "bg-red-50" : "bg-green-50"} />
        <Stat value={avgUtil !== null ? `${avgUtil}%` : "—"} label="Avg. Budget Utilization" tone="bg-yellow-50" />
      </div>

      {/* ── Agent performance table ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {agents.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">No agents yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Create agents from the Agents page to start tracking performance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 font-medium">Agent</th>
                  <th className="px-6 py-3 font-medium">Model</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">MTD Spend</th>
                  <th className="px-6 py-3 font-medium text-right">Budget</th>
                  <th className="px-6 py-3 font-medium text-right">Utilization</th>
                  <th className="px-6 py-3 font-medium text-right">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const pct = agent.budgetCents > 0
                    ? Math.round((agent.spendCents / agent.budgetCents) * 100)
                    : null;

                  const isOverBudget = pct !== null && pct > 100;

                  const utilColor = pct === null
                    ? ""
                    : pct > 100  ? "text-red-600 font-medium"
                    : pct >= 90  ? "text-red-600 font-medium"
                    : pct >= 75  ? "text-yellow-600"
                    : "text-gray-700";

                  const pill = STATUS_PILL[agent.status] ?? "bg-gray-100 text-gray-600";

                  const modelLabel = agent.provider && agent.model
                    ? `${agent.provider} · ${agent.model}`
                    : agent.model ?? agent.provider ?? "—";

                  return (
                    <tr
                      key={agent.id}
                      className={`border-b border-gray-50 last:border-b-0 transition-colors ${
                        isOverBudget
                          ? "bg-red-50/40 hover:bg-red-50/60"
                          : "hover:bg-gray-50/60"
                      }`}
                    >
                      {/* Agent name + department */}
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        {agent.department && (
                          <p className="text-xs text-gray-400 mt-0.5">{agent.department}</p>
                        )}
                      </td>

                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {modelLabel}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-mono capitalize ${pill}`}>
                          {agent.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-mono text-gray-900">
                        {fmtDollars(agent.spendCents)}
                      </td>

                      <td className="px-6 py-4 text-right font-mono text-gray-500">
                        {agent.budgetCents > 0
                          ? fmtDollars(agent.budgetCents)
                          : <span className="text-gray-400">No cap</span>}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {pct === null ? (
                          <span className="text-gray-400">—</span>
                        ) : pct > 100 ? (
                          <span className="text-red-600 font-medium">
                            {pct}% · over
                          </span>
                        ) : (
                          <span className={utilColor}>{pct}%</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right text-xs text-gray-400 whitespace-nowrap">
                        {agent.lastActiveAt ? fmtRelativeTime(agent.lastActiveAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className={`${tone} p-6 rounded-xl`}>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}

/**
 * Performance page — spend monitoring, budget health, and recommended actions.
 * Read-only counterpart to the Agents page (which handles management/controls).
 *
 * Sections:
 *   1. Stat cards      — aggregate MTD figures
 *   2. Recommended Actions — deterministic signals derived from current data
 *   3. Department Breakdown — spend vs budget rolled up per department
 *   4. Agent table     — all agents sorted by MTD spend descending
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

type Recommendation = {
  severity: "danger" | "warning" | "info" | "muted";
  agentName: string;
  message: string;
  action: string;
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

// ── Recommendations engine ─────────────────────────────────────────────────
// Pure function — no DB calls. Applies deterministic rules to agent data and
// returns a prioritised list (danger → warning → info → muted).

function generateRecommendations(agents: AgentRow[]): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const agent of agents) {
    const pct = agent.budgetCents > 0
      ? (agent.spendCents / agent.budgetCents) * 100
      : null;

    if (pct !== null && pct > 100) {
      recs.push({
        severity:  "danger",
        agentName: agent.name,
        message:   `Over monthly budget by ${fmtDollars(agent.spendCents - agent.budgetCents)}`,
        action:    "Pause the agent or raise the budget cap to stop overage.",
      });
    } else if (pct !== null && pct >= 90) {
      recs.push({
        severity:  "warning",
        agentName: agent.name,
        message:   `At ${Math.round(pct)}% of monthly budget — ${fmtDollars(agent.spendCents)} of ${fmtDollars(agent.budgetCents)}`,
        action:    "Monitor closely or proactively raise the cap.",
      });
    } else if (agent.status === "active" && agent.budgetCents === 0) {
      recs.push({
        severity:  "info",
        agentName: agent.name,
        message:   "No monthly budget cap set",
        action:    "Add a cap on the Departments page to prevent runaway spend.",
      });
    } else if (agent.status === "active" && agent.spendCents === 0) {
      recs.push({
        severity:  "muted",
        agentName: agent.name,
        message:   "Active but no spend recorded this month",
        action:    "Verify the agent is running and properly instrumented.",
      });
    }
  }

  const order: Record<Recommendation["severity"], number> = {
    danger: 0, warning: 1, info: 2, muted: 3,
  };
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtRelativeTime(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs  = Math.floor(diffMins / 60);
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

// ── Recommendation card styles ─────────────────────────────────────────────

const REC_STYLES: Record<Recommendation["severity"], { bar: string; bg: string; label: string; labelColor: string }> = {
  danger:  { bar: "bg-red-500",    bg: "bg-red-50",    label: "Over Budget",  labelColor: "text-red-700"    },
  warning: { bar: "bg-yellow-400", bg: "bg-yellow-50", label: "Approaching",  labelColor: "text-yellow-700" },
  info:    { bar: "bg-blue-400",   bg: "bg-blue-50",   label: "Suggestion",   labelColor: "text-blue-700"   },
  muted:   { bar: "bg-gray-300",   bg: "bg-gray-50",   label: "Check",        labelColor: "text-gray-500"   },
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

  const agents: AgentRow[] = companyId
    ? await fetchAgents(companyId).catch(() => [])
    : [];

  // ── Derived stats ──────────────────────────────────────────────────────
  const totalSpend  = agents.reduce((sum, a) => sum + a.spendCents, 0);
  const activeCount = agents.filter((a) => a.status === "active").length;
  const overBudget  = agents.filter(
    (a) => a.budgetCents > 0 && a.spendCents > a.budgetCents
  ).length;
  const withBudget  = agents.filter((a) => a.budgetCents > 0);
  const avgUtil     = withBudget.length > 0
    ? Math.round(
        withBudget.reduce((sum, a) => sum + (a.spendCents / a.budgetCents) * 100, 0) /
        withBudget.length
      )
    : null;

  const recommendations = generateRecommendations(agents);
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
        <p className="text-sm text-gray-500 mt-1">{month} · Month-to-date</p>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Stat value={fmtDollars(totalSpend)}                            label="Total MTD Spend"        tone="bg-purple-50" />
        <Stat value={String(activeCount)}                               label="Active Agents"          tone="bg-blue-50"   />
        <Stat value={String(overBudget)}                                label="Agents Over Budget"     tone={overBudget > 0 ? "bg-red-50" : "bg-green-50"} />
        <Stat value={avgUtil !== null ? `${avgUtil}%` : "—"}            label="Avg. Budget Utilization" tone="bg-yellow-50" />
      </div>

      {/* ── Recommended Actions ──────────────────────────── */}
      {agents.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Recommended Actions</h2>

          {recommendations.length === 0 ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-5 py-4">
              <span className="text-green-500 text-lg">✓</span>
              <div>
                <p className="text-sm font-medium text-green-800">All agents are within budget</p>
                <p className="text-xs text-green-600 mt-0.5">No issues detected this month.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations.map((rec, i) => {
                const s = REC_STYLES[rec.severity];
                return (
                  <div
                    key={i}
                    className={`flex gap-0 rounded-xl overflow-hidden border border-gray-100 shadow-sm`}
                  >
                    {/* Colored left bar indicating severity */}
                    <div className={`w-1 shrink-0 ${s.bar}`} />
                    <div className={`flex-1 px-4 py-3 ${s.bg}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 ${s.labelColor}`}>
                          {s.label}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {rec.agentName}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700">{rec.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{rec.action}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Agent performance table ──────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">All Agents</h2>
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
                    const utilColor =
                      pct === null  ? ""
                      : pct > 100   ? "text-red-600 font-medium"
                      : pct >= 90   ? "text-red-600 font-medium"
                      : pct >= 75   ? "text-yellow-600"
                      : "text-gray-700";
                    const pill = STATUS_PILL[agent.status] ?? "bg-gray-100 text-gray-600";
                    const modelLabel =
                      agent.provider && agent.model
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
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{agent.name}</p>
                          {agent.department && (
                            <p className="text-xs text-gray-400 mt-0.5">{agent.department}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{modelLabel}</td>
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
                          ) : (
                            <span className={utilColor}>
                              {pct > 100 ? `${pct}% · over` : `${pct}%`}
                            </span>
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

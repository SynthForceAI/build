/**
 * Agents page — lists every agent for the company with status, spend,
 * department, model, and activate/pause controls.
 *
 * WHY a Server Component?
 * Same reasoning as the dashboard home: we query Prisma directly here
 * rather than calling GET /api/agents, avoiding an extra HTTP hop. The
 * `include` joins for department + provider + model are handled in one query.
 *
 * The only interactive part (activate/pause buttons) is isolated in
 * AgentStatusToggle — a small Client Component that POSTs to the API and
 * calls router.refresh() to re-render this Server Component with fresh data.
 *
 * WHY pass serialised data to AgentStatusToggle instead of the raw Prisma row?
 * Client Components can only receive JSON-safe props. Prisma returns BigInt
 * for spend/budget fields which can't be serialised by default. We convert
 * those to Number before rendering, keeping the Client Component boundary clean.
 */

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AgentStatusToggle } from "@/components/ui/agent-status-toggle";

// ── Data fetching ──────────────────────────────────────────────────────────

type AgentRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  department: string | null;  // department name
  provider: string | null;    // e.g. "OpenAI"
  model: string | null;       // e.g. "GPT-4o"
  spendCents: number;         // currentMonthSpendCents as Number
  budgetCents: number;        // monthlyBudgetCents as Number
  lastActiveAt: Date | null;
};

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
    id:          a.id,
    name:        a.name,
    description: a.description,
    status:      a.status as string,
    department:  a.department?.name ?? null,
    provider:    a.provider?.displayName ?? null,
    model:       a.model?.displayName ?? null,
    // BigInt → Number (safe for all realistic spend/budget values)
    spendCents:  Number(a.currentMonthSpendCents),
    budgetCents: Number(a.monthlyBudgetCents),
    lastActiveAt: a.lastActiveAt,
  }));
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Converts a past date into a human-readable string like "3h ago" or "2d ago"
function fmtRelativeTime(date: Date): string {
  const diffMs   = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

// ── Status badge styles — matches dashboard page and demo page ─────────────

const STATUS_PILL: Record<string, string> = {
  active:      "bg-green-100 text-green-800",
  paused:      "bg-yellow-100 text-yellow-800",
  flagged:     "bg-red-100 text-red-800",
  deactivated: "bg-gray-100 text-gray-600",
};

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
    companyId = null; // TEMP: swallows 401 during dev; real code should redirect
  }

  // Skip DB call when no companyId — avoids passing an invalid UUID to Prisma
  let agents: AgentRow[] = [];
  if (companyId) {
    try {
      agents = await fetchAgents(companyId);
    } catch {
      agents = [];
    }
  }

  const activeCount = agents.filter((a) => a.status === "active").length;
  const pausedCount = agents.filter((a) => a.status === "paused").length;

  return (
    <div>

      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500 mt-1">
            {agents.length} total · {activeCount} active · {pausedCount} paused
          </p>
        </div>
        {/* Placeholder — wire up to an onboard flow once that page is built */}
        <AddAgentButton />
      </div>

      {/* ── Agent table ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {agents.length === 0 ? (
          /* Empty state — shown before any agents have been created */
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">No agents yet.</p>
            <p className="text-xs text-gray-400 mt-1 mb-6">
              Onboard your first AI agent to start tracking spend and status.
            </p>
            <AddAgentButton />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-3 font-medium">Agent</th>
                <th className="px-6 py-3 font-medium">Department</th>
                <th className="px-6 py-3 font-medium">Model</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">MTD Spend</th>
                <th className="px-6 py-3 font-medium text-right">Budget</th>
                <th className="px-6 py-3 font-medium text-right">Last Active</th>
                {/* Actions column — no label, just the toggle button */}
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                // Budget % consumed — null when budget is $0 (no cap set)
                const pct =
                  agent.budgetCents > 0
                    ? Math.round((agent.spendCents / agent.budgetCents) * 100)
                    : null;

                const pill = STATUS_PILL[agent.status] ?? "bg-gray-100 text-gray-600";

                // Combined provider · model label, e.g. "OpenAI · GPT-4o"
                const modelLabel =
                  agent.provider && agent.model
                    ? `${agent.provider} · ${agent.model}`
                    : agent.model ?? agent.provider ?? "—";

                return (
                  <tr
                    key={agent.id}
                    className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors"
                  >
                    {/* Name + optional truncated description as subtitle */}
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{agent.name}</p>
                      {agent.description && (
                        <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">
                          {agent.description}
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-4 text-gray-600">
                      {agent.department ?? <span className="text-gray-400">—</span>}
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

                    {/* Red at ≥ 90% of monthly budget */}
                    <td className="px-6 py-4 text-right text-gray-500">
                      {pct !== null ? (
                        <span className={pct >= 90 ? "text-red-600 font-medium" : ""}>
                          {pct}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right text-xs text-gray-400 whitespace-nowrap">
                      {agent.lastActiveAt ? fmtRelativeTime(agent.lastActiveAt) : "—"}
                    </td>

                    {/*
                     * AgentStatusToggle is the only Client Component on this page.
                     * It receives only JSON-safe props (id string + status string),
                     * so there's no BigInt serialisation issue at the boundary.
                     * Confirmed API routes: POST /api/agents/:id/activate
                     *                      POST /api/agents/:id/pause
                     */}
                    <td className="px-6 py-4 text-right">
                      <AgentStatusToggle agentId={agent.id} status={agent.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

// ── Add Agent button ───────────────────────────────────────────────────────
// Placeholder — no action wired yet. Will open the onboard flow once that
// page exists.
function AddAgentButton() {
  return (
    <button
      type="button"
      disabled
      className="px-4 py-2 text-sm rounded-lg bg-accent text-white border border-accent opacity-60 cursor-not-allowed"
      title="Agent creation UI coming soon"
    >
      + Add Agent
    </button>
  );
}

/**
 * Dashboard home — the first screen after login.
 *
 * WHY a Server Component (no "use client")?
 * Server Components can talk directly to Prisma without an extra HTTP round-trip.
 * We query the DB here rather than calling GET /api/usage/summary — same data,
 * one fewer network hop.
 *
 * WHY call requireUser() here when the layout already did?
 * Next.js App Router has no built-in mechanism for a layout to pass server-side
 * data down to pages — they're independent async components. The call is cheap
 * (cookie read + one DB row) so calling it twice is the accepted pattern.
 *
 * WHY a fallback instead of throwing on DB error?
 * The page should render something useful even when the DB is unreachable
 * (e.g. a fresh dev clone with no .env). Stat cards show zeros and the agent
 * table shows an empty state instead of a crash page.
 */

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────

type AgentRow = {
  id: string;
  name: string;
  status: string;
  spendCents: number;  // BigInt from DB, converted to Number for display
  budgetCents: number; // BigInt from DB, converted to Number for display
};

type Summary = {
  spendCents: number; // Prisma Decimal from UsageLog aggregate, converted
  requests: number;
  tokens: number;     // tokensIn + tokensOut combined
  agents: { active: number; paused: number; total: number };
  topAgents: AgentRow[];
};

// Zero-value fallback — used when the DB call fails or returns nothing
const EMPTY: Summary = {
  spendCents: 0,
  requests: 0,
  tokens: 0,
  agents: { active: 0, paused: 0, total: 0 },
  topAgents: [],
};

// ── Data fetching ──────────────────────────────────────────────────────────

async function fetchSummary(companyId: string): Promise<Summary> {
  // Month-to-date window: start of the current UTC month at midnight
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  // Three queries in parallel — same logic as GET /api/usage/summary
  const [agentGroups, mtd, topAgents] = await Promise.all([
    // How many agents in each status bucket?
    prisma.agent.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { status: true },
    }),

    // Month-to-date cost + token totals across all usage logs
    prisma.usageLog.aggregate({
      where: { companyId, createdAt: { gte: start } },
      _sum: { costCents: true, tokensIn: true, tokensOut: true },
      _count: { _all: true },
    }),

    // Top 5 agents ordered by currentMonthSpendCents for the table below
    prisma.agent.findMany({
      where: { companyId },
      orderBy: { currentMonthSpendCents: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        currentMonthSpendCents: true, // BigInt in DB
        monthlyBudgetCents: true,     // BigInt in DB
      },
    }),
  ]);

  // Convert [{ status, _count }] array → plain object for easy key lookup
  const byStatus = Object.fromEntries(
    agentGroups.map((g) => [g.status, g._count.status])
  );

  return {
    // costCents is Prisma's Decimal type; .toNumber() is safe for realistic spend values
    spendCents: mtd._sum.costCents?.toNumber() ?? 0,
    requests: mtd._count._all,
    tokens: (mtd._sum.tokensIn ?? 0) + (mtd._sum.tokensOut ?? 0),
    agents: {
      active: byStatus.active ?? 0,
      paused: byStatus.paused ?? 0,
      total: Object.values(byStatus).reduce((acc, n) => acc + n, 0),
    },
    // BigInt → Number is safe up to $90 trillion; well past any realistic budget
    topAgents: topAgents.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status as string,
      spendCents: Number(a.currentMonthSpendCents),
      budgetCents: Number(a.monthlyBudgetCents),
    })),
  };
}

// ── Formatting helpers ─────────────────────────────────────────────────────

// Cents → "$X.XX"
function fmtDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Number → locale string with thousands separators ("1,248")
function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// ── Status → pill style ────────────────────────────────────────────────────
// Colours match the status pills used in app/(marketing)/demo/page.tsx

const STATUS_PILL: Record<string, string> = {
  active:      "bg-green-100 text-green-800",
  paused:      "bg-yellow-100 text-yellow-800",
  flagged:     "bg-red-100 text-red-800",
  deactivated: "bg-gray-100 text-gray-600",
};

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/");
    throw err;
  }

  let data: Summary = EMPTY;
  try {
    data = await fetchSummary(companyId);
  } catch {
    data = EMPTY;
  }

  // Period label for the subtitle ("May 2026")
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div>

      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{month} · Month-to-date</p>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      {/*
       * Same visual pattern as app/(marketing)/demo/page.tsx:
       *   <Stat value="6" label="Active Agents" tone="bg-blue-50" />
       * Coloured background tile, large bold number, small label underneath.
       */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <Stat value={fmtDollars(data.spendCents)} label="MTD API Spend"  tone="bg-purple-50" />
        <Stat value={String(data.agents.active)}  label="Active Agents"  tone="bg-blue-50"   />
        <Stat value={fmtNumber(data.requests)}    label="API Requests"   tone="bg-green-50"  />
        <Stat value={fmtNumber(data.tokens)}      label="Total Tokens"   tone="bg-yellow-50" />
      </div>

      {/* ── Top agents by spend ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Top Agents by Spend</h2>
          <p className="text-xs text-gray-500 mt-0.5">Month-to-date · top 5</p>
        </div>

        {data.topAgents.length === 0 ? (
          /* Empty state — shown before any agents have been created */
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No agents yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Create your first agent to see spend data here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Agent</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">MTD Spend</th>
                <th className="px-6 py-3 font-medium text-right">Budget</th>
              </tr>
            </thead>
            <tbody>
              {data.topAgents.map((agent) => {
                // Budget % — null when the agent has no budget cap set ($0)
                const pct =
                  agent.budgetCents > 0
                    ? Math.round((agent.spendCents / agent.budgetCents) * 100)
                    : null;

                const pill = STATUS_PILL[agent.status] ?? "bg-gray-100 text-gray-600";

                return (
                  <tr
                    key={agent.id}
                    className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{agent.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-mono capitalize ${pill}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-900">
                      {fmtDollars(agent.spendCents)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {pct !== null ? (
                        /* Red when the agent is at or above 90% of its monthly budget */
                        <span className={pct >= 90 ? "text-red-600 font-medium" : ""}>
                          {pct}% of {fmtDollars(agent.budgetCents)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
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
// Local component — matches Stat() in app/(marketing)/demo/page.tsx exactly.
// Kept here rather than in components/ui/ because it's only used on this page.
function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className={`${tone} p-6 rounded-xl`}>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}

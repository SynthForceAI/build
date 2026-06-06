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

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { AgentGrid, type AgentCardData } from "./components/AgentGrid";
import { TopAgentsTable } from "./components/TopAgentsTable";
import { SpendTrendChart } from "./components/SpendTrendChart";

// ── Types ──────────────────────────────────────────────────────────────────

type ChecklistState = {
  hasApiKey: boolean;
  hasAgent: boolean;
  hasUsage: boolean;
};

type AgentRow = {
  id: string;
  name: string;
  status: string;
  spendCents: number;  // BigInt from DB, converted to Number for display
  budgetCents: number; // BigInt from DB, converted to Number for display
};

type DailySpend = { date: string; cents: number }; // date = "MM/DD"

type Summary = {
  spendCents: number; // Prisma Decimal from UsageLog aggregate, converted
  requests: number;
  tokens: number;     // tokensIn + tokensOut combined
  agents: { active: number; paused: number; total: number };
  topAgents: AgentRow[];
  gridAgents: AgentCardData[];
  checklist: ChecklistState;
  spendByDay: DailySpend[]; // last 7 days, oldest first
};

// Zero-value fallback — used when the DB call fails or returns nothing
const EMPTY: Summary = {
  spendCents: 0,
  requests: 0,
  tokens: 0,
  agents: { active: 0, paused: 0, total: 0 },
  topAgents: [],
  gridAgents: [],
  checklist: { hasApiKey: false, hasAgent: false, hasUsage: false },
  spendByDay: [],
};

// ── Data fetching ──────────────────────────────────────────────────────────

async function fetchSummary(companyId: string): Promise<Summary> {
  // Month-to-date window: start of the current UTC month at midnight
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  // Three queries in parallel. Spend data comes from ConnectedAgent/ConnectedAgentUsageLog
  // (written by the provider sync job). Agent counts still come from the Agent table
  // since that's where status management lives.
  const [agentGroups, mtd, topConnectedAgents] = await Promise.all([
    // How many agents in each status bucket?
    prisma.agent.groupBy({
      by: ["status"],
      where: { companyId, OR: [{ apiKeyId: null }, { apiKey: { deletedAt: null } }] },
      _count: { status: true },
    }),

    // Month-to-date cost + token totals from the sync-written usage log
    prisma.connectedAgentUsageLog.aggregate({
      where: { companyId, createdAt: { gte: start } },
      _sum: { costCents: true, tokensIn: true, tokensOut: true },
      _count: { _all: true },
    }),

    // Top 5 connected agents ordered by monthlySpendCents
    prisma.connectedAgent.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { monthlySpendCents: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        monthlySpendCents: true,
      },
    }),
  ]);

  // Last 7 days spend trend from the sync-written usage log
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const [recentLogs, apiKeyCount, allConnectedAgents] = await Promise.all([
    prisma.connectedAgentUsageLog.findMany({
      where: { companyId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, costCents: true },
    }),
    // Checklist: has the user connected a provider key yet?
    prisma.apiKey.count({ where: { companyId } }),
    // All connected agents for the directory grid
    prisma.connectedAgent.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { department: { select: { name: true } } },
    }),
  ]);

  // Bucket logs into calendar days (UTC), fill missing days with 0
  const dayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dayMap.set(d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" }), 0);
  }
  for (const log of recentLogs) {
    const key = log.createdAt.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" });
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) ?? 0) + (log.costCents?.toNumber() ?? 0));
    }
  }
  const spendByDay: DailySpend[] = Array.from(dayMap.entries()).map(([date, cents]) => ({ date, cents }));

  // Convert [{ status, _count }] array → plain object for easy key lookup
  const byStatus = Object.fromEntries(
    agentGroups.map((g) => [g.status, g._count.status])
  );

  return {
    spendCents: mtd._sum.costCents?.toNumber() ?? 0,
    requests: mtd._count._all,
    tokens: (mtd._sum.tokensIn ?? 0) + (mtd._sum.tokensOut ?? 0),
    agents: {
      active: byStatus.active ?? 0,
      paused: byStatus.paused ?? 0,
      total: Object.values(byStatus).reduce((acc, n) => acc + n, 0),
    },
    topAgents: topConnectedAgents.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status as string,
      spendCents: Number(a.monthlySpendCents),
      budgetCents: 0,
    })),
    gridAgents: allConnectedAgents.map((a) => ({
      id:             a.id,
      name:           a.name,
      role:           a.name,
      department:     a.department?.name ?? "Unassigned",
      status:         a.status as string,
      spendCents:     Number(a.monthlySpendCents),
      tasksCompleted: 0,
    })),
    checklist: {
      hasApiKey: apiKeyCount > 0,
      hasAgent:  allConnectedAgents.length > 0,
      hasUsage:  (mtd._count._all ?? 0) > 0,
    },
    spendByDay,
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

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{month} · Month-to-date</p>
        </div>
        <Link
          href="/U/onboard"
          className="inline-flex items-center px-5 py-2.5 text-sm font-medium bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition whitespace-nowrap"
        >
          + Onboard New Agent
        </Link>
      </div>

      {/* ── Get Started checklist — shown until all 3 steps complete ── */}
      {(!data.checklist.hasApiKey || !data.checklist.hasAgent || !data.checklist.hasUsage) && (
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-white border border-blue-100 rounded-2xl px-6 py-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Get started</h2>
          <ol className="space-y-2.5">
            <CheckStep
              done={data.checklist.hasApiKey}
              label="Connect an API provider"
              sub="Link your OpenAI, Anthropic, or other keys"
              href="/U/onboard"
              cta="Connect now"
            />
            <CheckStep
              done={data.checklist.hasAgent}
              label="Add your first agent"
              sub="Register an AI agent to start tracking"
              href="/U/onboard"
              cta="Add agent"
            />
            <CheckStep
              done={data.checklist.hasUsage}
              label="See your first usage data"
              sub="Make API calls — cost & tokens appear here automatically"
              href="/U/performance"
              cta="View performance"
            />
          </ol>
        </div>
      )}

      {data.agents.total === 0 ? (
        /* ── First-run empty state ──────────────────────── */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-16 flex flex-col items-center text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-[#00B2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Your AI workforce starts here</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Onboard your first AI agent to start tracking spend, setting budgets, and measuring ROI — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/U/onboard"
              className="px-5 py-2.5 bg-[#00B2FF] text-white text-sm font-medium rounded-lg hover:bg-[#00B2FF]/90 transition"
            >
              + Onboard your first agent
            </Link>
            <Link
              href="/U/agents"
              className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Browse agents
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            Supports OpenAI, Anthropic, and more. No code changes needed.
          </p>
        </div>
      ) : (
        <>
          {/* ── Stat cards ──────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Stat value={fmtDollars(data.spendCents)} label="MTD API Spend"  tone="bg-purple-50" />
            <Stat value={String(data.agents.active)}  label="Active Agents"  tone="bg-blue-50"   />
            <Stat value={fmtNumber(data.requests)}    label="API Requests"   tone="bg-green-50"  />
            <Stat value={fmtNumber(data.tokens)}      label="Total Tokens"   tone="bg-yellow-50" />
          </div>

          {/* ── Spend trend chart ────────────────────────────── */}
          {data.spendByDay.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 mb-10">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Spend — last 7 days</h2>
              <p className="text-xs text-gray-400 mb-4">Daily API cost in USD</p>
              <SpendTrendChart data={data.spendByDay} />
            </div>
          )}

          {/* ── Top agents by spend ─────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Top Agents by Spend</h2>
              <p className="text-xs text-gray-500 mt-0.5">Month-to-date · top 5 · click column headers to sort</p>
            </div>
            <TopAgentsTable agents={data.topAgents} />
          </div>

          {/* ── Agent directory grid ────────────────────────── */}
          <div className="mt-10">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Your Agent Directory</h2>
            <AgentGrid agents={data.gridAgents} />
          </div>
        </>
      )}

    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className={`${tone} p-6 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}

// ── Checklist step ─────────────────────────────────────────────────────────
function CheckStep({
  done, label, sub, href, cta,
}: { done: boolean; label: string; sub: string; href: string; cta: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
        done ? "border-[#00B2FF] bg-[#00B2FF]" : "border-gray-300 bg-white"
      }`} aria-hidden="true">
        {done && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${done ? "line-through text-gray-400" : "text-gray-800"}`}>
          {label}
        </span>
        {!done && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {!done && (
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-[#00B2FF] hover:underline"
        >
          {cta} →
        </Link>
      )}
    </li>
  );
}

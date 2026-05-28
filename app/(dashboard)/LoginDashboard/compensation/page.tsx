/**
 * Compensation page — API spend, ROI, and cost-optimization recommendations.
 *
 * Data strategy:
 *   - Agent spend/budget pulled from Prisma (real data, already in schema).
 *   - tasksCompleted is a placeholder (0) until UsageLog counts are wired.
 *   - ROI score is a heuristic: high = spend < 30% of budget & tasks > 1000,
 *     low = cost-per-task > $1.00, medium = everything else.
 *   - Delta indicators and recommendations are mock for now.
 *     TODO: derive deltas by comparing to prior-month UsageLog aggregates.
 *
 * To fully wire real data:
 *   1. Replace tasksCompleted with a usageLog.groupBy(agentId)._count query
 *   2. Replace StatWithDelta values with current vs. prior month aggregate queries
 *   3. Replace MOCK_RECOMMENDATIONS with a heuristics engine or LLM output
 */

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────

type CostRow = {
  id: string;
  name: string;
  department: string;
  monthlyCostCents: number;
  tasksCompleted: number;   // TODO: wire to usageLog count
  roiScore: "High" | "Medium" | "Low";
};

type Recommendation = {
  title: string;
  description: string;
  savingsCents: number;
  tone: string; // Tailwind bg class
};

// ── ROI heuristic ──────────────────────────────────────────────────────────

function roiScore(spendCents: number, tasks: number): CostRow["roiScore"] {
  if (tasks === 0) return "Low";
  const cpt = spendCents / tasks; // cents per task
  if (cpt < 30) return "High";
  if (cpt < 100) return "Medium";
  return "Low";
}

const ROI_PILL: Record<CostRow["roiScore"], string> = {
  High:   "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  Low:    "bg-red-100 text-red-800",
};

// ── Mock recommendations ────────────────────────────────────────────────────
// TODO: generate dynamically from agent data once tasksCompleted is wired

const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    title: "Switch Model for Expense Auditor",
    description:
      "Expense Auditor currently uses GPT-4o. Switching to Claude 3.5 Haiku could reduce cost per task by ~40% with minimal accuracy loss.",
    savingsCents: 20400,
    tone: "bg-green-50",
  },
  {
    title: "Batch Processing for Invoice Processor",
    description:
      "Invoice Processor handles each invoice individually. Enabling batch processing could reduce API calls by 30%.",
    savingsCents: 26700,
    tone: "bg-blue-50",
  },
];

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtCostPerTask(spendCents: number, tasks: number): string {
  if (tasks === 0) return "—";
  return `$${((spendCents / 100) / tasks).toFixed(2)}`;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function CompensationPage() {
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/");
    throw err;
  }

  const rawAgents = await prisma.agent.findMany({
    where:   { companyId },
    orderBy: { currentMonthSpendCents: "desc" },
    include: { department: { select: { name: true } } },
  }).catch(() => []);

  // TODO: replace 0 with real usageLog count per agent
  const rows: CostRow[] = rawAgents.map((a) => ({
    id:              a.id,
    name:            a.name,
    department:      a.department?.name ?? "Unassigned",
    monthlyCostCents: Number(a.currentMonthSpendCents),
    tasksCompleted:  0,
    roiScore:        roiScore(Number(a.currentMonthSpendCents), 0),
  }));

  const totalSpendCents = rows.reduce((s, r) => s + r.monthlyCostCents, 0);
  const totalTasks      = rows.reduce((s, r) => s + r.tasksCompleted, 0);

  return (
    <div className="space-y-8">

      {/* ── Page header ──────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Compensation</h1>
        <p className="text-sm text-gray-500 mt-1">
          API spend, ROI, and optimization recommendations.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      {/* TODO: replace delta values with real prior-month comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatWithDelta
          value={fmtDollars(totalSpendCents)}
          label="Monthly Spend"
          delta="+12% from last month"
          deltaTone="text-green-600"
          tone="bg-blue-50"
        />
        <StatWithDelta
          value="$18.5k"
          label="Estimated ROI (30d)"
          delta="+24% efficiency"
          deltaTone="text-green-600"
          tone="bg-green-50"
        />
        <StatWithDelta
          value={fmtCostPerTask(totalSpendCents, totalTasks)}
          label="Avg. Cost per Task"
          delta="+$0.02 vs target"
          deltaTone="text-red-600"
          tone="bg-purple-50"
        />
      </div>

      {/* ── Cost breakdown table ─────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Cost Breakdown by Agent</h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-500">No agents found.</p>
              <p className="text-xs text-gray-400 mt-1">
                Add agents from the{" "}
                <a href="/LoginDashboard/agents" className="text-[#00B2FF] underline">Agents</a>{" "}
                page to see spend data here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium text-right">Monthly Cost</th>
                    <th className="px-4 py-3 font-medium text-right">Tasks</th>
                    <th className="px-4 py-3 font-medium text-right">Cost / Task</th>
                    <th className="px-4 py-3 font-medium">ROI Score</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-gray-600">{row.department}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {fmtDollars(row.monthlyCostCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.tasksCompleted.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {fmtCostPerTask(row.monthlyCostCents, row.tasksCompleted)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROI_PILL[row.roiScore]}`}>
                          {row.roiScore}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {}}
                          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                          Optimize
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Recommendations ──────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Optimization Recommendations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MOCK_RECOMMENDATIONS.map((rec, i) => (
            <div key={i} className={`${rec.tone} p-6 rounded-xl`}>
              <h3 className="text-sm font-bold text-gray-900 mb-2">{rec.title}</h3>
              <p className="text-sm text-gray-700 mb-4">{rec.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  Est. monthly savings:{" "}
                  <strong className="text-gray-900">{fmtDollars(rec.savingsCents)}</strong>
                </span>
                <button
                  onClick={() => alert("Apply optimization — wire to API in production")}
                  className="px-4 py-1.5 text-xs bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition"
                >
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Components ─────────────────────────────────────────────────────────────

function StatWithDelta({
  value,
  label,
  delta,
  deltaTone,
  tone,
}: {
  value: string;
  label: string;
  delta: string;
  deltaTone: string;
  tone: string;
}) {
  return (
    <div className={`${tone} p-6 rounded-xl`}>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
      <div className={`text-xs mt-2 font-medium ${deltaTone}`}>{delta}</div>
    </div>
  );
}

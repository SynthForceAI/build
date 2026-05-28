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
  budgetCents: number;
  roiScore: "High" | "Medium" | "Low";
};

// ── ROI heuristic (spend vs budget) ───────────────────────────────────────

function roiScore(spendCents: number, budgetCents: number): CostRow["roiScore"] {
  if (budgetCents === 0) return "Low";
  const pct = (spendCents / budgetCents) * 100;
  if (pct <= 50)  return "High";
  if (pct <= 90)  return "Medium";
  return "Low";
}

const ROI_PILL: Record<CostRow["roiScore"], string> = {
  High:   "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  Low:    "bg-red-100 text-red-800",
};

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

  const rows: CostRow[] = rawAgents.map((a) => ({
    id:               a.id,
    name:             a.name,
    department:       a.department?.name ?? "Unassigned",
    monthlyCostCents: Number(a.currentMonthSpendCents),
    budgetCents:      Number(a.monthlyBudgetCents),
    roiScore:         roiScore(Number(a.currentMonthSpendCents), Number(a.monthlyBudgetCents)),
  }));

  const totalSpendCents  = rows.reduce((s, r) => s + r.monthlyCostCents, 0);
  const totalBudgetCents = rows.reduce((s, r) => s + r.budgetCents, 0);
  const overBudgetCount  = rows.filter((r) => r.budgetCents > 0 && r.monthlyCostCents > r.budgetCents).length;

  return (
    <div className="space-y-8">

      {/* ── Page header ──────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Compensation</h1>
        <p className="text-sm text-gray-500 mt-1">
          API spend and budget utilisation across all connected agents.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Stat value={fmtDollars(totalSpendCents)}  label="Total Monthly Spend"  tone="bg-blue-50"   />
        <Stat value={fmtDollars(totalBudgetCents)} label="Total Budget Cap"     tone="bg-green-50"  />
        <Stat
          value={String(overBudgetCount)}
          label="Agents Over Budget"
          tone={overBudgetCount > 0 ? "bg-red-50" : "bg-gray-50"}
        />
      </div>

      {/* ── Cost breakdown table ─────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Cost Breakdown by Agent</h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-500">No connected agents yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Start by{" "}
                <a href="/LoginDashboard/onboard" className="text-[#00B2FF] underline">
                  connecting an existing agent
                </a>{" "}
                above — spend data will appear automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium text-right">Monthly Spend</th>
                    <th className="px-4 py-3 font-medium text-right">Budget Cap</th>
                    <th className="px-4 py-3 font-medium text-right">Utilisation</th>
                    <th className="px-4 py-3 font-medium">ROI Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const pct = row.budgetCents > 0
                      ? Math.round((row.monthlyCostCents / row.budgetCents) * 100)
                      : null;
                    const utilColor =
                      pct === null ? "text-gray-400"
                      : pct > 100  ? "text-red-600 font-medium"
                      : pct >= 90  ? "text-yellow-600"
                      : "text-gray-700";

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                        <td className="px-4 py-3 text-gray-600">{row.department}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900">
                          {fmtDollars(row.monthlyCostCents)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">
                          {row.budgetCents > 0 ? fmtDollars(row.budgetCents) : <span className="text-gray-400">No cap</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pct === null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className={utilColor}>{pct}%</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROI_PILL[row.roiScore]}`}>
                            {row.roiScore}
                          </span>
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

      {/* ── Recommendations ──────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Optimization Recommendations</h2>
        <div className="bg-gray-50 rounded-xl px-6 py-8 text-center">
          <p className="text-sm text-gray-500">
            Optimization recommendations will appear once your agents have usage data.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Connect an agent and run some tasks — we&rsquo;ll surface cost-saving opportunities automatically.
          </p>
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

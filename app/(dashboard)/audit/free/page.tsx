import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { ShareButton } from "./ShareButton";
import { RerunButton } from "./RerunButton";
import { BurnRateCard } from "./BurnRateCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelRow = {
  model:           string;
  costCents:       number;
  calls:           number;
  tokensIn:        number;
  tokensOut:       number;
  tokensInCached?: number;
};

type DailySpend = {
  date: string;
  costCents: number;
  calls: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDollars(cents: bigint | number | null): string {
  const n = cents === null ? 0 : typeof cents === "bigint" ? Number(cents) : cents;
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function efficiencyColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function efficiencyLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 60) return "Fair";
  return "Needs Attention";
}

function severityDot(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-500";
    case "high":     return "bg-orange-500";
    case "medium":   return "bg-yellow-500";
    case "low":      return "bg-blue-400";
    default:         return "bg-gray-400";
  }
}

function severityBadge(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-50 text-red-700 border-red-200";
    case "high":     return "bg-orange-50 text-orange-700 border-orange-200";
    case "medium":   return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "low":      return "bg-blue-50 text-blue-700 border-blue-200";
    default:         return "bg-gray-50 text-gray-600 border-gray-200";
  }
}

function formatPeriod(start: Date | null, end: Date | null): string {
  if (!start || !end) return "Last 30 days";
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatModelName(raw: string): string {
  // OpenAI style: base-YYYY-MM-DD  →  base v.YYYY
  const m1 = raw.match(/^(.+?)-(\d{4})-\d{2}-\d{2}$/);
  if (m1) return `${m1[1]} v.${m1[2]}`;
  // Anthropic style: base-YYYYMMDD  →  base v.YYYY  (year must be 2020-2039)
  const m2 = raw.match(/^(.+?)-(20[2-3]\d)\d{4}$/);
  if (m2) return `${m2[1]} v.${m2[2]}`;
  return raw;
}

function inferRole(m: ModelRow): { label: string; description: string; colorClass: string } {
  const total = m.tokensIn + m.tokensOut;
  if (total === 0) return { label: "Unknown", description: "No token data available.", colorClass: "text-gray-500 bg-gray-50 border-gray-200" };
  const inputRatio = m.tokensIn / total;
  if (inputRatio > 0.72) return { label: "Researcher", description: "Input-heavy. Likely retrieval, Q&A, or context processing.", colorClass: "text-blue-700 bg-blue-50 border-blue-200" };
  if (inputRatio < 0.42) return { label: "Writer / Coder", description: "Output-heavy. Likely code generation or content creation.", colorClass: "text-purple-700 bg-purple-50 border-purple-200" };
  return { label: "Analyst", description: "Balanced token mix. Likely reasoning or multi-step analysis.", colorClass: "text-amber-700 bg-amber-50 border-amber-200" };
}

function utilizationBand(rate: number): { label: string; colorClass: string; barColor: string } {
  if (rate < 0.30) return { label: "Underutilized", colorClass: "text-orange-600", barColor: "bg-orange-400" };
  if (rate < 0.70) return { label: "Fair", colorClass: "text-yellow-600", barColor: "bg-yellow-400" };
  if (rate <= 0.85) return { label: "Healthy", colorClass: "text-green-600", barColor: "bg-green-500" };
  return { label: "High", colorClass: "text-orange-600", barColor: "bg-orange-500" };
}

function isFlagshipModel(model: string): boolean {
  const n = model.toLowerCase();
  return (n.startsWith("gpt-4") && !n.includes("mini") && !n.includes("nano")) ||
    n.startsWith("o1") || n.startsWith("o3") ||
    n.includes("claude-3-opus") || n.includes("claude-opus-4") ||
    n.includes("gemini-ultra") || n.includes("gemini-1.5-pro");
}

function detectSpike(daily: DailySpend[]): { spikeDate: string; multiple: number } | null {
  if (daily.length < 7) return null;
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.floor(sorted.length / 2);
  const baselineMean = sorted.slice(0, half).reduce((s, d) => s + d.costCents, 0) / half;
  if (baselineMean < 50) return null;
  const peak = sorted.reduce((mx, d) => d.costCents > mx.costCents ? d : mx, sorted[0]);
  const multiple = peak.costCents / baselineMean;
  if (multiple < 2.5) return null;
  return { spikeDate: peak.date, multiple: Math.round(multiple * 10) / 10 };
}

function detectOvertime(daily: DailySpend[]): { highDays: number; avgMultiple: number } | null {
  if (daily.length < 7) return null;
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.floor(sorted.length / 2);
  const baselineMean = sorted.slice(0, half).reduce((s, d) => s + d.costCents, 0) / half;
  if (baselineMean < 100) return null;
  const last7 = sorted.slice(-7);
  const highDays = last7.filter(d => d.costCents > baselineMean * 1.3).length;
  if (highDays < 5) return null;
  const avgMultiple = last7.reduce((s, d) => s + d.costCents, 0) / 7 / baselineMean;
  return { highDays, avgMultiple: Math.round(avgMultiple * 10) / 10 };
}

function cacheInfo(m: ModelRow): { ratePct: number; opportunity: boolean } | null {
  if (!m.tokensInCached || m.tokensIn === 0) return null;
  const ratePct = Math.round(Math.min(100, (m.tokensInCached / m.tokensIn) * 100));
  return { ratePct, opportunity: ratePct < 30 && m.tokensIn > 20000 };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function FreeAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  // Auth
  let companyId: string;
  try {
    const { user } = await requireUser();
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const { id } = await searchParams;
  if (!id) notFound();

  const audit = await prisma.audit.findUnique({
    where: { id },
    include: {
      findings: {
        orderBy: [{ orderHint: "asc" }, { severity: "desc" }],
        take: 5,
      },
    },
  });

  if (!audit || audit.companyId !== companyId) notFound();

  // ---------------------------------------------------------------------------
  // Pending / processing state
  // ---------------------------------------------------------------------------

  if (audit.status === "pending" || audit.status === "processing") {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6 animate-pulse">
          <svg className="w-8 h-8 text-[#00B2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v4m0 8v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4 12H8m8 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Analyzing your spend…</h1>
        <p className="text-sm text-gray-500">This usually takes 15–30 seconds. Refresh in a moment.</p>
        <Link href={`/audit/free?id=${id}`} className="mt-6 inline-block text-sm text-[#00B2FF] hover:underline">
          Refresh →
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Failed state
  // ---------------------------------------------------------------------------

  if (audit.status === "failed") {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Audit failed</h1>
        <p className="text-sm text-gray-500 mb-1">We couldn&apos;t complete the analysis.</p>
        {audit.errorMessage && (
          <p className="text-xs text-red-500 font-mono bg-red-50 rounded-lg px-4 py-2 inline-block mt-2 max-w-md">
            {audit.errorMessage}
          </p>
        )}
        <div className="mt-8">
          <Link href="/U/onboard" className="px-5 py-2.5 bg-[#00B2FF] text-white text-sm font-medium rounded-lg hover:bg-[#00B2FF]/90 transition">
            Try again →
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Completed - extract data
  // ---------------------------------------------------------------------------

  const spendCents = Number(audit.totalMonthlySpendCents ?? 0);
  const wasteCents = Number(audit.estimatedWasteCents ?? 0);
  const score = Math.round(Number(audit.efficiencyScore ?? 100));
  const period = formatPeriod(audit.dataPeriodStart, audit.dataPeriodEnd);

  const reportData = audit.reportData as {
    byModel?: ModelRow[];
    dailySpendCents?: DailySpend[];
  } | null;

  const byModel: ModelRow[] = reportData?.byModel ?? [];
  const totalModelSpend = byModel.reduce((s, m) => s + m.costCents, 0);
  const dailySpend: DailySpend[] = reportData?.dailySpendCents ?? [];
  const activeDays = dailySpend.filter(d => d.costCents > 0).length;
  const totalDays = dailySpend.length;
  const utilization = totalDays > 0 ? activeDays / totalDays : 0;
  const utilBand = utilizationBand(utilization);
  const spike = detectSpike(dailySpend);
  const overtime = detectOvertime(dailySpend);
  const avgModelCost = byModel.length > 1 ? totalModelSpend / byModel.length : 0;

  // Insight 5: spend trend first-half vs second-half
  const spendTrend = (() => {
    if (dailySpend.length < 14) return null;
    const sorted = [...dailySpend].sort((a, b) => a.date.localeCompare(b.date));
    const half = Math.floor(sorted.length / 2);
    const firstAvg  = sorted.slice(0, half).reduce((s, d) => s + d.costCents, 0) / half;
    const secondAvg = sorted.slice(half).reduce((s, d) => s + d.costCents, 0) / (sorted.length - half);
    if (firstAvg === 0) return null;
    const pct = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
    // Per-model context load (tokens per call) for models with call data
    const modelContext = byModel
      .filter((m) => m.calls > 0 && m.tokensIn > 0)
      .map((m) => {
        const tpc = Math.round(m.tokensIn / m.calls);
        const label = tpc > 100_000 ? "Very heavy" : tpc > 50_000 ? "Heavy" : tpc > 10_000 ? "Moderate" : "Light";
        return { model: m.model, tpc, label, heavy: tpc > 50_000 };
      });
    return { pct, modelContext };
  })();

  // Insight 9: batch eligibility — flagship/mid-tier models with high call volumes
  const batchCandidates = byModel.filter((m) => {
    const n = m.model.toLowerCase();
    const isCheap = n.includes("mini") || n.includes("nano") || n.includes("haiku") || n.includes("flash");
    return m.calls > 500 && !isCheap && m.costCents > 500;
  });
  const batchSavingsEstimateCents = batchCandidates.reduce(
    (s, m) => s + Math.round(m.costCents * 0.25), 0,
  );

  // Insight 11: burn rate (7-day rolling average)
  const burnRate = (() => {
    if (dailySpend.length < 7) return null;
    const sorted = [...dailySpend].sort((a, b) => a.date.localeCompare(b.date));
    const last7  = sorted.slice(-7);
    const prev7  = sorted.slice(-14, -7);
    const last7Avg = last7.reduce((s, d) => s + d.costCents, 0) / last7.length;
    if (last7Avg === 0) return null;
    const prev7Avg = prev7.length > 0
      ? prev7.reduce((s, d) => s + d.costCents, 0) / prev7.length
      : last7Avg;
    const trendPct = prev7Avg > 0
      ? Math.round(((last7Avg - prev7Avg) / prev7Avg) * 100)
      : 0;
    return {
      dailyRateCents:  Math.round(last7Avg),
      weeklyRateCents: Math.round(last7Avg * 7),
      trendPct,
    };
  })();

  // Top 3 findings (already sorted by orderHint then severity)
  const topFindings = audit.findings.slice(0, 5);

  // Share text
  const modelSummary = byModel
    .slice(0, 3)
    .map((m) => `${m.model} ${totalModelSpend > 0 ? Math.round((m.costCents / totalModelSpend) * 100) : 0}%`)
    .join(" • ");

  const shareText = [
    "AI Workforce Summary (via SynthForce)",
    `Spending: ${fmtDollars(audit.totalMonthlySpendCents)}/month`,
    modelSummary ? `Models: ${modelSummary}` : null,
    `Efficiency: ${score}/100 (${efficiencyLabel(score)})`,
    topFindings[0] ? `Top finding: ${topFindings[0].title}` : null,
    wasteCents > 0 ? `Potential savings: ${fmtDollars(wasteCents)}/month` : null,
    "",
    "synthforceai.com",
  ]
    .filter(Boolean)
    .join("\n");

  const colorClass = efficiencyColor(score);

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">{period}</p>
        </div>
        <div className="flex gap-3 items-start">
          <ShareButton text={shareText} />
          <RerunButton auditId={id as string} />
        </div>
      </div>

      {/* ── Summary cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-purple-50 rounded-xl p-5">
          <div className="text-2xl font-bold text-gray-900">{fmtDollars(audit.totalMonthlySpendCents)}</div>
          <div className="text-sm text-gray-600 mt-0.5">Total Spend</div>
        </div>
        <div className={`rounded-xl p-5 border ${colorClass}`}>
          <div className="text-2xl font-bold">{score}<span className="text-sm font-normal ml-1">/100</span></div>
          <div className="text-sm mt-0.5">Efficiency: {efficiencyLabel(score)}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-5">
          <div className="text-2xl font-bold text-gray-900">{fmtDollars(wasteCents > 0 ? wasteCents : 0)}</div>
          <div className="text-sm text-gray-600 mt-0.5">Potential Monthly Savings</div>
        </div>
      </div>

      {/* ── Synthetic Workforce (Insights 1, 2, 4, 7) ───────────────────── */}
      {byModel.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-900">Your Synthetic Workforce</h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full shrink-0 ml-3">
              {byModel.length} model{byModel.length !== 1 ? "s" : ""} active
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Each model in your billing data represents a role in your AI fleet. Role labels are inferred from token patterns.
          </p>
          <div className="space-y-4">
            {byModel.map((m) => {
              const role = inferRole(m);
              const pct = totalModelSpend > 0 ? (m.costCents / totalModelSpend) * 100 : 0;
              const isOutlier = avgModelCost > 0 && m.costCents > avgModelCost * 3 && byModel.length > 1;
              const flagship = isFlagshipModel(m.model);
              return (
                <div key={m.model} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{formatModelName(m.model)}</span>
                        {isOutlier && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium shrink-0">
                            Compensation outlier
                          </span>
                        )}
                        {flagship && !isOutlier && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium shrink-0">
                            Flagship tier
                          </span>
                        )}
                      </div>
                      <span className={`mt-1.5 inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${role.colorClass}`}>
                        {role.label}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                      {flagship && m.calls > 500 && (
                        <p className="text-xs text-amber-600 mt-2">
                          {m.calls.toLocaleString()} calls on a flagship model. Simple tasks may qualify for a mini-tier model at up to 97% lower cost. Est. savings: {fmtDollars(Math.round(m.costCents * 0.90))}/mo if workload qualifies.
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-gray-900">{fmtDollars(m.costCents)}</div>
                      <div className="text-xs text-gray-500">salary / period</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{Math.round(pct)}% of payroll</span>
                      <span>{m.calls.toLocaleString()} calls</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00B2FF] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {(() => {
                    const cache = cacheInfo(m);
                    if (!cache) return null;
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Cache rate</span>
                          <span className={`text-xs font-medium ${cache.ratePct >= 50 ? "text-green-600" : cache.ratePct >= 30 ? "text-yellow-600" : "text-orange-600"}`}>
                            {cache.ratePct}%
                            {cache.ratePct < 50 && <span className="text-gray-400 font-normal"> vs 74% benchmark</span>}
                          </span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cache.ratePct >= 50 ? "bg-green-500" : cache.ratePct >= 30 ? "bg-yellow-400" : "bg-orange-400"}`}
                            style={{ width: `${cache.ratePct}%` }}
                          />
                        </div>
                        {cache.opportunity && (
                          <p className="text-xs text-orange-600 mt-1.5">
                            Low cache rate. Moving static content into your cached prefix could significantly reduce input token costs.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
          {byModel.length > 1 && avgModelCost > 0 && (
            <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
              Average model salary this period: {fmtDollars(Math.round(avgModelCost))}
            </p>
          )}
        </div>
      )}

      {/* ── Fleet Utilization (Insight 3) ────────────────────────────────── */}
      {totalDays > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Fleet Utilization</h2>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">{activeDays} of {totalDays} days active</span>
            <span className={`text-sm font-bold ${utilBand.colorClass}`}>
              {Math.round(utilization * 100)}% — {utilBand.label}
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className={`h-full ${utilBand.barColor} rounded-full`} style={{ width: `${Math.round(utilization * 100)}%` }} />
          </div>
          <p className="text-xs text-gray-500">
            Healthy utilization is 70–85%.
            {utilization < 0.30 && " Your fleet is largely idle. Consider retiring unused models to reduce payroll."}
            {utilization >= 0.30 && utilization < 0.70 && " Your fleet runs on a moderate schedule."}
            {utilization >= 0.70 && utilization <= 0.85 && " Your fleet is running at a healthy rate."}
            {utilization > 0.85 && " Your fleet runs nearly every day. Watch for runaway loops or unintended always-on spend."}
          </p>
        </div>
      )}

      {/* ── Fleet Performance Review (Insight 5) ─────────────────────────── */}
      {spendTrend && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Fleet Performance Review</h2>

          {/* Spend trend verdict */}
          <div className={`rounded-xl p-4 mb-4 border ${
            spendTrend.pct < -10 ? "bg-green-50 border-green-200" :
            spendTrend.pct >  10 ? "bg-orange-50 border-orange-200" :
            "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">Overall fleet verdict</span>
              <span className={`text-sm font-bold ${
                spendTrend.pct < -10 ? "text-green-700" :
                spendTrend.pct >  10 ? "text-orange-600" :
                "text-gray-700"
              }`}>
                {spendTrend.pct < -10 ? "Exceeds Expectations" :
                 spendTrend.pct >  10 ? "Needs Improvement" :
                 "Meets Expectations"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {spendTrend.pct < -10
                ? `Daily spend is down ${Math.abs(spendTrend.pct)}% in the second half of the period. Efficiency is improving.`
                : spendTrend.pct > 10
                ? `Daily spend is up ${spendTrend.pct}% in the second half of the period. Context bloat or increased load.`
                : "Daily spend is stable across the period."}
            </p>
          </div>

          {/* Per-model context load */}
          {spendTrend.modelContext.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Context load per request</p>
              <div className="space-y-2">
                {spendTrend.modelContext.map((mc) => (
                  <div key={mc.model} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700 truncate max-w-[55%]">{formatModelName(mc.model)}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-500">{mc.tpc.toLocaleString()} tokens/call</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        mc.heavy ? "bg-orange-50 text-orange-700 border border-orange-200" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {mc.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Burnout / Overtime (Insight 6) ───────────────────────────────── */}
      {overtime && (
        <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-6">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5" aria-hidden="true">🔥</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Sustained High Spend Detected</h2>
              <p className="text-sm text-gray-600 mb-2">
                {overtime.highDays} of the last 7 days ran at {overtime.avgMultiple}x the period baseline. Sustained elevated spend is a warning sign for runaway agents or unintended always-on workloads.
              </p>
              <p className="text-xs text-gray-400">
                Real-time runaway detection requires the SynthForce proxy layer. Billing data can only flag the pattern after the fact.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Eligibility (Insight 9) ────────────────────────────────── */}
      {batchCandidates.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-900">Batch Eligibility</h2>
            {batchSavingsEstimateCents > 0 && (
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full shrink-0 ml-3">
                Est. save {fmtDollars(batchSavingsEstimateCents)}/mo
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-4">
            OpenAI and Anthropic both offer a 50% discount via their Batch API for non-urgent requests. These models have high call volumes that may qualify.
          </p>
          <div className="space-y-2">
            {batchCandidates.map((m) => (
              <div key={m.model} className="flex items-center justify-between text-xs py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-700 truncate max-w-[55%]">{formatModelName(m.model)}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-gray-500">{m.calls.toLocaleString()} calls</span>
                  <span className="text-green-700 font-medium">
                    Save {fmtDollars(Math.round(m.costCents * 0.25))}/mo if 50% moves to batch
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Estimate assumes 50% of calls are non-time-sensitive and a 50% batch discount. Actual savings depend on your workload.
          </p>
        </div>
      )}

      {/* ── Findings ─────────────────────────────────────────────────────── */}
      {topFindings.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Key Findings</h2>
          <div className="space-y-4">
            {topFindings.map((f) => (
              <div key={f.id} className="flex gap-3">
                <div className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${severityDot(f.severity)}`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{f.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityBadge(f.severity)}`}>
                      {f.severity}
                    </span>
                    {f.potentialSavingsCents && Number(f.potentialSavingsCents) > 0 && (
                      <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                        Save {fmtDollars(Number(f.potentialSavingsCents))}/mo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI-generated report summary ──────────────────────────────────── */}
      {audit.reportSummary && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-[#00B2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347A3.001 3.001 0 0112 21a3 3 0 01-2.121-.879l-.347-.347z" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-900">Analysis</h2>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{audit.reportSummary}</p>
        </div>
      )}

      {/* ── Benchmarking (placeholder until data moat builds) ────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Peer Benchmarking</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Coming soon</span>
        </div>
        <p className="text-sm text-gray-500">
          See how your spend compares to similar-sized companies. Available once we have enough anonymized data to calculate reliable percentiles.
        </p>
      </div>

      {/* ── What This Audit Cannot Tell You Yet (Insights 12, 13) ─────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">What This Audit Cannot Tell You Yet</h2>

        {/* Insight 12: Attribution gap */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-start gap-3">
            <span className="text-base mt-0.5" aria-hidden="true">🕳️</span>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">Attribution gap</p>
              <p className="text-sm text-gray-600">
                100% of your spend is visible by API key and model. 0% is traceable to a task, customer, or outcome. Billing data shows you the invoice. It cannot show you what produced it.
              </p>
              <p className="text-xs text-gray-400 mt-2">Install the SynthForce proxy layer to close the gap.</p>
            </div>
          </div>
        </div>

        {/* Insight 13: Spike forensics */}
        {spike && (
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <div className="flex items-start gap-3">
              <span className="text-base mt-0.5" aria-hidden="true">🚨</span>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Spend spike detected</p>
                <p className="text-sm text-gray-600">
                  Spend on {new Date(spike.spikeDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} ran at {spike.multiple}x the period baseline. Bug or feature? Billing data cannot say which.
                </p>
                <p className="text-xs text-gray-400 mt-2">Upgrade for per-request root cause.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Burn Rate Forecast (Insight 11) ──────────────────────────────── */}
      {burnRate && (
        <BurnRateCard
          dailyRateCents={burnRate.dailyRateCents}
          weeklyRateCents={burnRate.weeklyRateCents}
          trendPct={burnRate.trendPct}
        />
      )}

      {/* ── Upgrade CTA ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#00B2FF]/10 to-blue-50 border border-blue-100 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Ready to go deeper?</h2>
        <p className="text-sm text-gray-600 mb-4">
          Track individual agents, set budgets, and get real-time alerts when spend spikes.
        </p>
        <Link
          href="/U/onboard"
          className="inline-flex items-center px-5 py-2.5 text-sm font-medium bg-[#00B2FF] text-white rounded-lg hover:bg-[#00B2FF]/90 transition"
        >
          Track per-agent spend →
        </Link>
      </div>

    </div>
  );
}

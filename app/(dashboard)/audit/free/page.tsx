import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { ShareButton } from "./ShareButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelRow = {
  model: string;
  costCents: number;
  calls: number;
  tokensIn: number;
  tokensOut: number;
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
  // Completed — extract data
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
        <div className="flex gap-3">
          <ShareButton text={shareText} />
          <Link
            href="/U/onboard"
            className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            + Track agents
          </Link>
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
          <div className="text-sm mt-0.5">Efficiency — {efficiencyLabel(score)}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-5">
          <div className="text-2xl font-bold text-gray-900">{fmtDollars(wasteCents > 0 ? wasteCents : 0)}</div>
          <div className="text-sm text-gray-600 mt-0.5">Potential Monthly Savings</div>
        </div>
      </div>

      {/* ── Model breakdown ──────────────────────────────────────────────── */}
      {byModel.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Spend by Model</h2>
          <div className="space-y-3">
            {byModel.map((m) => {
              const pct = totalModelSpend > 0 ? (m.costCents / totalModelSpend) * 100 : 0;
              return (
                <div key={m.model}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span className="font-medium truncate max-w-[60%]">{m.model}</span>
                    <span>{fmtDollars(m.costCents)} · {Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00B2FF] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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
            <h2 className="text-sm font-semibold text-gray-900">AI Analysis</h2>
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

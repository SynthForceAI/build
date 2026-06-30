import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { getAuditQuota } from "@/lib/audit/quota";
import { ShareButton } from "./ShareButton";
import { RerunButton } from "./RerunButton";
import { BurnRateCard } from "./BurnRateCard";
import { InfoTip } from "./InfoTip";
import { Flame, CircleSlash, AlertTriangle } from "lucide-react";
import type {
  TelemetryInsights,
  HighVolumeProject,
  ModelMismatchCandidate,
} from "@/lib/audit/telemetry";

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

type ReportData = {
  byModel?:        ModelRow[];
  dailySpendCents?: DailySpend[];
  telemetry?:      TelemetryInsights;
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

function severityText(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-700";
    case "high":     return "text-orange-700";
    case "medium":   return "text-yellow-700";
    case "low":      return "text-blue-600";
    default:         return "text-gray-500";
  }
}

function formatPeriod(start: Date | null, end: Date | null): string {
  if (!start || !end) return "Last 30 days";
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatModelName(raw: string): string {
  const m1 = raw.match(/^(.+?)-(\d{4})-\d{2}-\d{2}$/);
  if (m1) return `${m1[1]} v.${m1[2]}`;
  const m2 = raw.match(/^(.+?)-(20[2-3]\d)\d{4}$/);
  if (m2) return `${m2[1]} v.${m2[2]}`;
  return raw;
}

function inferRole(m: ModelRow): { label: string; description: string; dotColor: string; textColor: string } {
  const total = m.tokensIn + m.tokensOut;
  if (total === 0) return { label: "Unknown", description: "No token data available.", dotColor: "bg-gray-400", textColor: "text-gray-500" };
  const inputRatio = m.tokensIn / total;
  if (inputRatio > 0.72) return { label: "Researcher", description: "Input-heavy. Likely retrieval, Q&A, or context processing.", dotColor: "bg-blue-500", textColor: "text-blue-700" };
  if (inputRatio < 0.42) return { label: "Writer / Coder", description: "Output-heavy. Likely code generation or content creation.", dotColor: "bg-purple-500", textColor: "text-purple-700" };
  return { label: "Analyst", description: "Balanced token mix. Likely reasoning or multi-step analysis.", dotColor: "bg-amber-500", textColor: "text-amber-700" };
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
// Telemetry insight section components (server-side, inline)
// ---------------------------------------------------------------------------

function NoDataPlaceholder({ message }: { message: string }) {
  return (
    <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4 border border-gray-200">
      {message}
    </p>
  );
}

function InsightCard({
  id,
  title,
  titleTip,
  finding,
  whyItMatters,
  recommendation,
  estimatedImpactCents,
  children,
}: {
  id: string;
  title: string;
  titleTip?: string;
  finding: string;
  whyItMatters: string;
  recommendation: string;
  estimatedImpactCents?: number;
  children?: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
      <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-1">
        {title}
        {titleTip && <InfoTip text={titleTip} />}
      </h2>
      <div className="space-y-3 mb-4">
        <div>
          <span className="text-xs font-medium text-gray-500">Finding</span>
          <p className="text-sm text-gray-800 mt-0.5">{finding}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500">Why it matters</span>
          <p className="text-sm text-gray-800 mt-0.5">{whyItMatters}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500">Recommendation</span>
          <p className="text-sm text-gray-800 mt-0.5">{recommendation}</p>
        </div>
        {estimatedImpactCents !== undefined && estimatedImpactCents > 0 && (
          <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-gray-500">Estimated impact</span>
            <span className="text-sm font-bold text-green-700">{fmtDollars(estimatedImpactCents)}/month</span>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function HighVolumeProjectsSection({ projects }: { projects: HighVolumeProject[] | null | undefined }) {
  if (projects === undefined) {
    return (
      <div id="high-volume-projects" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">High-Volume Projects <InfoTip text="Projects or workspaces consuming a disproportionate share of your API spend. Outliers often contain runaway automation, retry loops, or unexpectedly heavy usage." /></h2>
        <NoDataPlaceholder message="Run a new audit to see this insight." />
      </div>
    );
  }

  if (projects === null || projects.length === 0) {
    return (
      <div id="high-volume-projects" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">High-Volume Projects <InfoTip text="Projects or workspaces consuming a disproportionate share of your API spend. Outliers often contain runaway automation, retry loops, or unexpectedly heavy usage." /></h2>
        <NoDataPlaceholder message="No project-level data available. Your API key may need 'Read usage data' permission in the OpenAI dashboard." />
      </div>
    );
  }

  const totalSpend = projects.reduce((s, p) => s + p.costCents, 0);
  const outliers = projects.filter((p) => p.isOutlier);
  const totalSavingsHint = outliers.length > 0
    ? `${outliers.length} project${outliers.length > 1 ? "s are" : " is"} consuming a disproportionate share of spend. Reviewing their workloads could uncover optimization opportunities.`
    : "Spend looks well-distributed across projects.";

  return (
    <InsightCard
      id="high-volume-projects"
      title="High-Volume Projects"
      titleTip="Projects or workspaces consuming a disproportionate share of your API spend. Outliers often contain runaway automation, retry loops, or unexpectedly heavy usage."
      finding={`${projects.length} project${projects.length !== 1 ? "s" : ""} detected. ${outliers.length > 0 ? `${outliers.length} flagged as spend outliers.` : "No outliers detected."}`}
      whyItMatters="Projects with disproportionate spend often contain redundant calls, over-provisioned models, or runaway loops that haven't been caught yet."
      recommendation="Review the flagged projects for unnecessary model upgrades or retry storms. Consider setting per-project spend alerts."
      estimatedImpactCents={outliers.reduce((s, p) => s + Math.round(p.costCents * 0.3), 0)}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-gray-500 font-medium">Project ID</th>
              <th className="text-right py-2 text-gray-500 font-medium">Spend</th>
              <th className="text-right py-2 text-gray-500 font-medium">Share</th>
              <th className="text-right py-2 text-gray-500 font-medium">MoM</th>
              <th className="text-right py-2 text-gray-500 font-medium">Calls</th>
            </tr>
          </thead>
          <tbody>
            {projects.slice(0, 10).map((p) => (
              <tr key={p.projectId} className="border-b border-gray-50 last:border-0">
                <td className="py-2 text-gray-700 font-mono truncate max-w-[160px]">
                  {p.projectId.slice(0, 20)}{p.projectId.length > 20 ? "…" : ""}
                  {p.isOutlier && (
                    <span className="ml-2 inline-flex items-center gap-1 font-sans font-medium text-red-700">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500" />
                      outlier
                    </span>
                  )}
                </td>
                <td className="py-2 text-right text-gray-900 font-medium">{fmtDollars(p.costCents)}</td>
                <td className="py-2 text-right text-gray-600">{p.spendSharePct.toFixed(1)}%</td>
                <td className="py-2 text-right">
                  {p.prevCostCents > 0 ? (
                    <span className={p.momChangePct > 10 ? "text-red-600 font-medium" : p.momChangePct < -5 ? "text-green-600 font-medium" : "text-gray-600"}>
                      {p.momChangePct > 0 ? "+" : ""}{p.momChangePct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2 text-right text-gray-600">{p.calls > 0 ? p.calls.toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalSpend > 0 && (
        <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">{totalSavingsHint}</p>
      )}
    </InsightCard>
  );
}

function ModelMismatchSection({ mismatch }: { mismatch: TelemetryInsights["modelMismatch"] | undefined }) {
  if (mismatch === undefined) {
    return (
      <div id="model-mismatch" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">Right Tool for the Job <InfoTip text="Checks whether you're using expensive, high-capability AI models for simple tasks that a cheaper, smaller model would handle just as well — at 70–95% lower cost." /></h2>
        <NoDataPlaceholder message="Run a new audit to see this insight." />
      </div>
    );
  }

  if (!mismatch || mismatch.candidates.length === 0) {
    return (
      <div id="model-mismatch" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">Right Tool for the Job <InfoTip text="Checks whether you're using expensive, high-capability AI models for simple tasks that a cheaper, smaller model would handle just as well — at 70–95% lower cost." /></h2>
        <div className="flex items-start gap-3 bg-green-50 rounded-xl p-4 border border-green-200">
          <svg className="w-4 h-4 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-green-800">All models look well-matched to their tasks. No overkill patterns detected.</p>
        </div>
      </div>
    );
  }

  const totalSavings = mismatch.candidates.reduce((s, c) => s + c.estimatedSavingsCents, 0);

  return (
    <InsightCard
      id="model-mismatch"
      title="Right Tool for the Job"
      titleTip="Checks whether you're using expensive, high-capability AI models for simple tasks that a cheaper, smaller model would handle just as well — at 70–95% lower cost."
      finding={`${mismatch.candidates.length} model${mismatch.candidates.length !== 1 ? "s" : ""} may be over-specified for the work they are doing.`}
      whyItMatters="Using flagship models for short, simple outputs is the single fastest way to overspend on AI. Switching to a smaller model for these tasks has no meaningful quality impact at low output lengths."
      recommendation="Test each flagged model with a smaller alternative on a 5% traffic sample. If quality holds, roll it out fully."
      estimatedImpactCents={totalSavings}
    >
      <div className="space-y-3">
        {mismatch.candidates.map((c: ModelMismatchCandidate) => (
          <div key={c.model} className="border border-gray-100 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-gray-700 truncate">{formatModelName(c.model)}</span>
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-medium text-[#00B2FF] shrink-0">{c.suggestedModel}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${
                c.confidence === "high" ? "bg-green-50 text-green-700 border-green-200" :
                c.confidence === "medium" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                "bg-gray-50 text-gray-600 border-gray-200"
              }`}>
                {c.confidence} confidence
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-gray-500">
              <div>
                <div className="font-medium text-gray-900 text-sm">{c.avgOutputTokens.toLocaleString()}</div>
                <div>avg output tokens/call</div>
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm">{c.callCount.toLocaleString()}</div>
                <div>calls this period</div>
              </div>
              <div>
                <div className="font-medium text-green-700 text-sm">{fmtDollars(c.estimatedSavingsCents)}/mo</div>
                <div>est. savings</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}

function CacheEfficiencySection({ cache }: { cache: TelemetryInsights["cacheEfficiency"] | undefined }) {
  if (cache === undefined) {
    return (
      <div id="cache-efficiency" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">Cache Efficiency <InfoTip text="Anthropic charges up to 90% less for 'cached' input tokens — content your system prompt has already sent before. A high cache hit rate means you're getting significant discounts automatically." /></h2>
        <NoDataPlaceholder message="Run a new audit to see this insight." />
      </div>
    );
  }

  if (!cache) return null;

  const aboveBenchmark = cache.cacheHitRatePct >= cache.benchmarkPct;

  return (
    <InsightCard
      id="cache-efficiency"
      title="Cache Efficiency"
      titleTip="Anthropic charges up to 90% less for 'cached' input tokens — content your system prompt has already sent before. A high cache hit rate means you're getting significant discounts automatically."
      finding={`Your cache hit rate is ${cache.cacheHitRatePct.toFixed(1)}% — ${aboveBenchmark ? "above" : "below"} the ${cache.benchmarkPct}% industry benchmark.`}
      whyItMatters="Anthropic charges up to 90% less for cached input tokens. A low cache rate means you are paying full price for content your system has already processed before."
      recommendation={cache.recommendation}
      estimatedImpactCents={aboveBenchmark ? undefined : cache.potentialSavingsCents}
    >
      {/* Progress bar with benchmark marker */}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>0%</span>
          <span className="text-gray-700 font-medium">{cache.cacheHitRatePct.toFixed(1)}% current</span>
          <span>100%</span>
        </div>
        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${aboveBenchmark ? "bg-green-500" : cache.cacheHitRatePct >= 50 ? "bg-yellow-400" : "bg-orange-400"}`}
            style={{ width: `${Math.min(100, cache.cacheHitRatePct)}%` }}
          />
          {/* Benchmark marker at 70% */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500"
            style={{ left: `${cache.benchmarkPct}%` }}
            title={`${cache.benchmarkPct}% benchmark`}
          />
        </div>
        <div className="flex justify-end mt-1">
          <span className="text-xs text-blue-600">{cache.benchmarkPct}% benchmark</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-500">
          <div>
            <div className="font-medium text-gray-900 text-sm">{(cache.cachedTokens / 1_000_000).toFixed(1)}M</div>
            <div>cached tokens</div>
          </div>
          <div>
            <div className="font-medium text-gray-900 text-sm">{(cache.totalInputTokens / 1_000_000).toFixed(1)}M</div>
            <div>total input tokens</div>
          </div>
        </div>
        {aboveBenchmark && (
          <div className="mt-3 flex items-center gap-2 bg-green-50 rounded-lg p-3 border border-green-200">
            <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs text-green-800">You are above the industry benchmark. Your caching strategy is working well.</p>
          </div>
        )}
      </div>
    </InsightCard>
  );
}

function ReasoningEfficiencySection({ reasoning }: { reasoning: TelemetryInsights["reasoningEfficiency"] | undefined }) {
  if (!reasoning) return null;

  const overthinkingModels = reasoning.models.filter((m) => m.ratio > 10);

  return (
    <InsightCard
      id="reasoning-efficiency"
      title="Reasoning Efficiency"
      titleTip="o1 and o3 models think step-by-step before producing output, consuming extra 'reasoning tokens.' A very high reasoning-to-output ratio often means the model is overthinking tasks that a simpler model could handle cheaply."
      finding={`${reasoning.models.length} reasoning model${reasoning.models.length !== 1 ? "s" : ""} detected. ${overthinkingModels.length > 0 ? `${overthinkingModels.length} show${overthinkingModels.length === 1 ? "s" : ""} a high reasoning-to-output token ratio.` : "Ratios look proportionate."}`}
      whyItMatters="o1 and o3 models burn extra tokens on internal reasoning before producing output. A very high reasoning-to-output ratio often means the model is overthinking tasks that a simpler model could handle."
      recommendation={overthinkingModels.length > 0 ? "Consider routing straightforward tasks to GPT-4o to avoid unnecessary reasoning overhead." : "Continue monitoring as usage grows."}
    >
      <div className="space-y-2">
        {reasoning.models.map((m) => (
          <div key={m.model} className={`border rounded-xl p-4 ${m.ratio > 10 ? "border-orange-200 bg-orange-50" : "border-gray-100"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-gray-700">{formatModelName(m.model)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                m.ratio > 10 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-gray-50 text-gray-600 border-gray-200"
              }`}>
                {m.ratio}x ratio
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-gray-500 mb-2">
              <div>
                <div className="font-medium text-gray-900 text-sm">{m.avgReasoningTokensPerCall.toLocaleString()}</div>
                <div>avg reasoning tokens</div>
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm">{m.avgOutputTokensPerCall.toLocaleString()}</div>
                <div>avg output tokens</div>
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm">{fmtDollars(m.costCents)}</div>
                <div>period cost</div>
              </div>
            </div>
            {m.ratio > 10 && (
              <p className="text-xs text-orange-700 mt-1">{m.recommendation}</p>
            )}
          </div>
        ))}
      </div>
    </InsightCard>
  );
}

function BatchOpportunitySection({ batch }: { batch: TelemetryInsights["batchOpportunity"] | undefined }) {
  if (batch === undefined) {
    return (
      <div id="batch-opportunity" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">Batch Opportunity <InfoTip text="OpenAI's Batch API lets you submit requests that don't need an instant response. OpenAI processes them within 24 hours at a 50% discount. Ideal for any background processing, data enrichment, or bulk analysis." /></h2>
        <NoDataPlaceholder message="Run a new audit to see this insight." />
      </div>
    );
  }

  if (!batch) return null;

  if (!batch.eligible) {
    return (
      <div id="batch-opportunity" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">Batch Opportunity <InfoTip text="OpenAI's Batch API lets you submit requests that don't need an instant response. OpenAI processes them within 24 hours at a 50% discount. Ideal for any background processing, data enrichment, or bulk analysis." /></h2>
        <NoDataPlaceholder message="Your call volume is below the threshold where batching makes a meaningful difference (500+ calls, $5+/period)." />
      </div>
    );
  }

  return (
    <InsightCard
      id="batch-opportunity"
      title="Batch Opportunity"
      titleTip="OpenAI's Batch API lets you submit requests that don't need an instant response. OpenAI processes them within 24 hours at a 50% discount. Ideal for any background processing, data enrichment, or bulk analysis."
      finding={`${batch.realtimeCalls.toLocaleString()} realtime calls this period (${fmtDollars(batch.realtimeCostCents)}). Up to 60% may be eligible for the Batch API.`}
      whyItMatters="OpenAI's Batch API gives a 50% discount on any request that can wait up to 24 hours for a response. For background processing, data enrichment, or offline analysis, this is free money."
      recommendation="Identify non-urgent workflows and route them through the Batch API. Start with any pipeline that runs overnight or processes data in bulk."
      estimatedImpactCents={batch.estimatedSavingsCents}
    >
      <a
        href="https://platform.openai.com/docs/api-reference/batch"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-[#00B2FF] hover:underline mt-1"
      >
        OpenAI Batch API docs
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </InsightCard>
  );
}

function UnusedKeysSection({ keys }: { keys: TelemetryInsights["unusedKeys"] | undefined }) {
  if (keys === undefined) {
    return (
      <div id="unused-keys" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">Unused API Keys <InfoTip text="API keys that made zero requests during the audit period. Dormant keys are a security risk — if leaked, an attacker could generate spend or access your data before you notice." /></h2>
        <NoDataPlaceholder message="Run a new audit to see this insight." />
      </div>
    );
  }

  if (keys === null) {
    return (
      <div id="unused-keys" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">Unused API Keys <InfoTip text="API keys that made zero requests during the audit period. Dormant keys are a security risk — if leaked, an attacker could generate spend or access your data before you notice." /></h2>
        <NoDataPlaceholder message="Enable 'Read usage data' permission on your admin key to see key-level activity." />
      </div>
    );
  }

  const unusedKeys = keys.filter((k) => k.isUnused);
  const activeKeys = keys.filter((k) => !k.isUnused);

  return (
    <div id="unused-keys" className="bg-white rounded-md border border-gray-200 shadow-sm p-6 scroll-mt-20">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Unused API Keys</h2>
      <div className="space-y-3 mb-4">
        <div>
          <span className="text-xs font-medium text-gray-500">Finding</span>
          <p className="text-sm text-gray-800 mt-0.5">
            {unusedKeys.length > 0
              ? `${unusedKeys.length} API key${unusedKeys.length !== 1 ? "s" : ""} generated zero traffic this period.`
              : `All ${keys.length} keys were active this period.`}
          </p>
        </div>
        {unusedKeys.length > 0 && (
          <>
            <div>
              <span className="text-xs font-medium text-gray-500">Why it matters</span>
              <p className="text-sm text-gray-800 mt-0.5">Dormant keys are a standing credential risk. If leaked, an attacker could generate spend or exfiltrate data before you notice.</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Recommendation</span>
              <p className="text-sm text-gray-800 mt-0.5">Revoke any key that has not generated traffic in 30 days. Only keep keys that are actively in use.</p>
            </div>
          </>
        )}
      </div>
      {keys.length > 0 && (
        <div className="space-y-2">
          {unusedKeys.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-600 mb-2">Inactive keys (zero calls)</p>
              {unusedKeys.map((k) => (
                <div key={k.apiKeyId} className="flex items-center justify-between text-xs py-2 border-b border-gray-50 last:border-0">
                  <span className="font-mono text-gray-700 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                    …{k.apiKeyId.slice(-4)}
                  </span>
                  <span className="text-red-600 font-medium">0 calls — revoke recommended</span>
                </div>
              ))}
            </div>
          )}
          {activeKeys.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Active keys</p>
              {activeKeys.map((k) => (
                <div key={k.apiKeyId} className="flex items-center justify-between text-xs py-2 border-b border-gray-50 last:border-0">
                  <span className="font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                    …{k.apiKeyId.slice(-4)}
                  </span>
                  <span className="text-gray-600">{k.calls.toLocaleString()} calls · {fmtDollars(k.costCents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section nav type
// ---------------------------------------------------------------------------

type NavSection = {
  id:    string;
  label: string;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function FreeAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; section?: string; sections?: string }>;
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

  const { id, section, sections: urlSections } = await searchParams;
  const activeSection = section ?? "overview";
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

  const reportData = audit.reportData as ReportData | null;

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

  // Extract telemetry (null on old audits)
  const telemetry = reportData?.telemetry ?? null;
  const provider = telemetry?.provider ?? null;

  // Insight 5: spend trend first-half vs second-half
  const spendTrend = (() => {
    if (dailySpend.length < 14) return null;
    const sorted = [...dailySpend].sort((a, b) => a.date.localeCompare(b.date));
    const half = Math.floor(sorted.length / 2);
    const firstAvg  = sorted.slice(0, half).reduce((s, d) => s + d.costCents, 0) / half;
    const secondAvg = sorted.slice(half).reduce((s, d) => s + d.costCents, 0) / (sorted.length - half);
    if (firstAvg === 0) return null;
    const pct = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
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

  // One-free-audit moat: gate the re-run control on the company's quota.
  const quota = await getAuditQuota(companyId);

  // Build sidebar sections conditionally
  const navSections: NavSection[] = [
    { id: "overview", label: "Overview" },
  ];

  // High-volume projects: show if telemetry available and provider is openai
  if (provider === "openai") {
    navSections.push({ id: "high-volume-projects", label: "High-Volume Projects" });
  }

  navSections.push({ id: "model-mismatch", label: "Right Tool for the Job" });

  if (provider === "anthropic") {
    navSections.push({ id: "cache-efficiency", label: "Cache Efficiency" });
  }

  if (provider === "openai" && telemetry?.reasoningEfficiency) {
    navSections.push({ id: "reasoning-efficiency", label: "Reasoning Efficiency" });
  }

  if (provider === "openai") {
    navSections.push({ id: "batch-opportunity", label: "Batch Opportunity" });
    navSections.push({ id: "unused-keys", label: "Unused Keys" });
  }

  // Sync applicable sections to URL so the sidebar can filter its links
  const sectionIds = navSections.map((s) => s.id).join(",");
  if (urlSections !== sectionIds) {
    redirect(`/audit/free?id=${id}&section=${activeSection}&sections=${sectionIds}`);
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">{period}</p>
        </div>
        <div className="flex gap-3 items-start">
          <ShareButton text={shareText} />
          {quota.canRun ? (
            <RerunButton auditId={id as string} />
          ) : (
            <div className="flex flex-col items-start gap-1">
              <Link
                href="/U/billing"
                className="px-4 py-2 text-sm font-medium bg-[#00B2FF] text-white rounded-lg hover:bg-[#00B2FF]/90 transition inline-flex items-center gap-2"
              >
                Upgrade to re-run →
              </Link>
              <span className="text-xs text-gray-400">Free audit used</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile section nav (desktop uses the left sidebar) */}
      <nav className="lg:hidden overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        <div className="flex gap-2 whitespace-nowrap">
          {navSections.map((s) => (
            <a
              key={s.id}
              href={`/audit/free?id=${id}&section=${s.id}`}
              className={
                activeSection === s.id
                  ? "inline-block text-xs px-3 py-1.5 rounded-full bg-[#00B2FF] text-white"
                  : "inline-block text-xs px-3 py-1.5 rounded-full text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-[#00B2FF] transition-colors"
              }
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Section content ───────────────────────────────────────────── */}
      <div className="space-y-6">

          {/* ── Overview ──────────────────────────────────────────────────── */}
          {activeSection === "overview" && (
          <div className="space-y-6">

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-purple-50 rounded-xl p-5">
                <div className="text-2xl font-bold text-gray-900">{fmtDollars(audit.totalMonthlySpendCents)}</div>
                <div className="text-sm text-gray-600 mt-0.5">Total Spend</div>
              </div>
              <div className={`rounded-xl p-5 border ${colorClass}`}>
                <div className="text-2xl font-bold">{score}<span className="text-sm font-normal ml-1">/100</span></div>
                <div className="text-sm mt-0.5 flex items-center gap-1">
                  Efficiency: {efficiencyLabel(score)}
                  <InfoTip text="A 0 to 100 score based on how much of your spend SynthForce estimates could be reduced through model swaps, caching, or workload changes. 80 and above is good. 60 to 79 is fair. Below 60 needs attention." />
                </div>
              </div>
              <div className="bg-green-50 rounded-xl p-5">
                <div className="text-2xl font-bold text-gray-900">{fmtDollars(wasteCents > 0 ? wasteCents : 0)}</div>
                <div className="text-sm text-gray-600 mt-0.5">Potential Monthly Savings</div>
              </div>
            </div>

            {/* Synthetic Workforce */}
            {byModel.length > 0 && (
              <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-sm font-semibold text-gray-900">Your Synthetic Workforce</h2>
                  <span className="text-xs text-gray-500 shrink-0 ml-3">
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
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500" />
                                  Compensation outlier
                                </span>
                              )}
                              {flagship && !isOutlier && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
                                  Flagship tier
                                </span>
                              )}
                            </div>
                            <span className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${role.textColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${role.dotColor}`} />
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
                                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                  Cache rate
                                  <InfoTip text="The share of your input tokens served from the provider's prompt cache. Cached tokens cost up to 90% less than uncached ones. A low rate means your fleet is paying full price for content it has already seen before." />
                                </span>
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

            {/* Fleet Utilization */}
            {totalDays > 0 && (
              <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-1">
                  Fleet Utilization
                  <InfoTip text="The percentage of days in the audit period where your fleet logged at least one API call. A healthy fleet runs between 70% and 85% of days. Below 30% suggests idle models sitting on your payroll. Above 85% is worth watching for unintended always-on spend." />
                </h2>
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

            {/* Fleet Performance Review */}
            {spendTrend && (
              <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Fleet Performance Review</h2>
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

            {/* Burnout / Overtime */}
            {overtime && (
              <div className="bg-white rounded-md border border-orange-200 shadow-sm p-6">
                <div className="flex items-start gap-3">
                  <Flame className="w-5 h-5 mt-0.5 text-orange-500 shrink-0" aria-hidden="true" />
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

            {/* Batch Eligibility (existing overview card) */}
            {batchCandidates.length > 0 && (
              <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-sm font-semibold text-gray-900">Batch Eligibility</h2>
                  {batchSavingsEstimateCents > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 shrink-0 ml-3">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-green-500" />
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

            {/* Key Findings */}
            {topFindings.length > 0 && (
              <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Key Findings</h2>
                <div className="space-y-4">
                  {topFindings.map((f) => (
                    <div key={f.id} className="flex gap-3">
                      <div className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${severityDot(f.severity)}`} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{f.title}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium capitalize ${severityText(f.severity)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${severityDot(f.severity)}`} />
                            {f.severity}
                          </span>
                          {f.potentialSavingsCents && Number(f.potentialSavingsCents) > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-green-500" />
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

            {/* AI-generated report summary */}
            {audit.reportSummary && (
              <div className="bg-blue-50 border border-blue-100 rounded-md p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-[#00B2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347A3.001 3.001 0 0112 21a3 3 0 01-2.121-.879l-.347-.347z" />
                  </svg>
                  <h2 className="text-sm font-semibold text-gray-900">Analysis</h2>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{audit.reportSummary}</p>
              </div>
            )}

            {/* Benchmarking placeholder */}
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Peer Benchmarking</h2>
                <span className="text-xs text-gray-400">Coming soon</span>
              </div>
              <p className="text-sm text-gray-500">
                See how your spend compares to similar-sized companies. Available once we have enough anonymized data to calculate reliable percentiles.
              </p>
            </div>

            {/* What This Audit Cannot Tell You Yet */}
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">What This Audit Cannot Tell You Yet</h2>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <CircleSlash className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Attribution gap</p>
                    <p className="text-sm text-gray-600">
                      100% of your spend is visible by API key and model. 0% is traceable to a task, customer, or outcome. Billing data shows you the invoice. It cannot show you what produced it.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Install the SynthForce proxy layer to close the gap.</p>
                  </div>
                </div>
              </div>
              {spike && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-orange-500 shrink-0" aria-hidden="true" />
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

            {/* Burn Rate Forecast */}
            <BurnRateCard
              dailyRateCents={burnRate?.dailyRateCents ?? null}
              weeklyRateCents={burnRate?.weeklyRateCents ?? null}
              trendPct={burnRate?.trendPct ?? null}
            />

            {/* Upgrade CTA */}
            <div className="bg-gradient-to-r from-[#00B2FF]/10 to-blue-50 border border-blue-100 rounded-md p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Ready to go deeper?</h2>
              <p className="text-sm text-gray-600 mb-4">
                {quota.canRun
                  ? "Track individual agents, set budgets, and get real-time alerts when spend spikes."
                  : "This was your free audit. Upgrade to re-run anytime, track individual agents, set budgets, and get real-time alerts when spend spikes."}
              </p>
              <Link
                href={quota.canRun ? "/U/onboard" : "/U/billing"}
                className="inline-flex items-center px-5 py-2.5 text-sm font-medium bg-[#00B2FF] text-white rounded-lg hover:bg-[#00B2FF]/90 transition"
              >
                {quota.canRun ? "Track per-agent spend →" : "View upgrade options →"}
              </Link>
            </div>

          </div>
          )}

          {/* ── High-Volume Projects (OpenAI only) ──────────────────────── */}
          {activeSection === "high-volume-projects" && provider === "openai" && (
            <HighVolumeProjectsSection projects={telemetry?.highVolumeProjects} />
          )}

          {/* ── Right Tool for the Job ────────────────────────────────────── */}
          {activeSection === "model-mismatch" && (
            <ModelMismatchSection mismatch={telemetry?.modelMismatch} />
          )}

          {/* ── Cache Efficiency (Anthropic only) ────────────────────────── */}
          {activeSection === "cache-efficiency" && provider === "anthropic" && (
            <CacheEfficiencySection cache={telemetry?.cacheEfficiency} />
          )}

          {/* ── Reasoning Efficiency (OpenAI o1 only) ────────────────────── */}
          {activeSection === "reasoning-efficiency" && provider === "openai" && (
            <ReasoningEfficiencySection reasoning={telemetry?.reasoningEfficiency} />
          )}

          {/* ── Batch Opportunity (OpenAI only) ──────────────────────────── */}
          {activeSection === "batch-opportunity" && provider === "openai" && (
            <BatchOpportunitySection batch={telemetry?.batchOpportunity} />
          )}

          {/* ── Unused Keys (OpenAI only) ────────────────────────────────── */}
          {activeSection === "unused-keys" && provider === "openai" && (
            <UnusedKeysSection keys={telemetry?.unusedKeys} />
          )}

      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

// ── API types ──────────────────────────────────────────────────────────────

type BreakdownItem = {
  model: string;
  providerName: string;
  providerDisplayName: string;
  costCents: number;
  tokensIn: number;
  tokensOut: number;
  requests: number;
  pctOfTotal: number;
};

type DailyPoint = { day: string; costCents: number };

type UsageSummary = {
  periodDays: number;
  totals: { costCents: number; tokensIn: number; tokensOut: number; requests: number };
  breakdown: BreakdownItem[];
  daily: DailyPoint[];
};

type Recommendation = {
  type: string;
  title: string;
  detail: string;
  potentialSavingsCents: number;
  priority: "high" | "medium" | "low";
};

type Insights = {
  trend: { direction: "up" | "down" | "flat"; pct: number; label: string };
  benchmark: {
    position: "above" | "below" | "median" | "unknown";
    label: string;
    medianCents: number;
    yourCents30d: number;
    ratio: number | null;
  };
  recommendations: Recommendation[];
  potentialSavingsCents: number;
};

type ConnectedProvider = {
  providerId: string;
  providerName: string;
  displayName: string;
  fingerprint: string;
  connectedAt: string;
  lastSyncedAt: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const BAR_COLORS = ["#00B2FF", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899"];

// ── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-16 flex flex-col items-center text-center max-w-lg mx-auto mt-10">
      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-[#00B2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">No spending data yet</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-6">
        Connect a provider admin key to start tracking your AI spending. Data syncs automatically every hour.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/U/onboard"
          className="px-5 py-2.5 bg-[#00B2FF] text-white text-sm font-medium rounded-lg hover:bg-[#00B2FF]/90 transition"
        >
          Connect provider
        </Link>
        <Link
          href="/U/settings"
          className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
        >
          View settings
        </Link>
      </div>
      <div className="mt-8 text-left w-full max-w-xs space-y-3 border-t border-gray-100 pt-6">
        <p className="text-xs font-medium text-gray-500 mb-2">How it works:</p>
        <div className="flex gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-[#00B2FF] text-xs font-bold flex items-center justify-center">1</span>
          <p className="text-xs text-gray-600">Connect your API key (encrypted, read-only)</p>
        </div>
        <div className="flex gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-[#00B2FF] text-xs font-bold flex items-center justify-center">2</span>
          <p className="text-xs text-gray-600">We sync your last 30 days of spending</p>
        </div>
        <div className="flex gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-[#00B2FF] text-xs font-bold flex items-center justify-center">3</span>
          <p className="text-xs text-gray-600">Get insights and cost recommendations</p>
        </div>
      </div>
    </div>
  );
}

// ── Spending card ──────────────────────────────────────────────────────────

function SpendingCard({
  totals,
  trend,
  days,
  loading,
}: {
  totals: UsageSummary["totals"] | null;
  trend: Insights["trend"] | null;
  days: number;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        This Period ({days}d)
      </p>
      {loading || !totals ? (
        <>
          <Skeleton className="h-9 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </>
      ) : (
        <>
          <div className="text-4xl font-bold text-gray-900 mb-1">
            {fmtDollars(Number(totals.costCents))}
          </div>
          {trend && trend.direction !== "flat" && (
            <div className={`inline-flex items-center gap-1 text-sm font-medium ${
              trend.direction === "up" ? "text-red-500" : "text-green-600"
            }`}>
              {trend.direction === "up" ? "↑" : "↓"} {trend.pct}% vs prior period
            </div>
          )}
          {trend?.direction === "flat" && (
            <div className="text-sm text-gray-400">Stable vs prior period</div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-gray-100 text-center">
            <div>
              <div className="text-sm font-semibold text-gray-800">{fmtK(totals.requests)}</div>
              <div className="text-xs text-gray-400">Requests</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{fmtK(totals.tokensIn)}</div>
              <div className="text-xs text-gray-400">Tokens in</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{fmtK(totals.tokensOut)}</div>
              <div className="text-xs text-gray-400">Tokens out</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Model breakdown bar chart ──────────────────────────────────────────────

function ModelBreakdown({
  breakdown,
  loading,
}: {
  breakdown: BreakdownItem[];
  loading: boolean;
}) {
  const chartData = breakdown.slice(0, 5).map((b) => ({
    name: b.model.length > 22 ? b.model.slice(0, 20) + "…" : b.model,
    costCents: Number(b.costCents),
    pct: b.pctOfTotal,
  }));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">By Model</h2>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      ) : breakdown.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No model data</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <XAxis type="number" tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [fmtDollars(Number(v ?? 0)), "Cost"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Bar dataKey="costCents" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1">
            {breakdown.slice(0, 5).map((b, i) => (
              <div key={b.model} className="flex items-center justify-between text-xs text-gray-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                  {b.model}
                </span>
                <span className="font-medium">{b.pctOfTotal}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Spending trend line chart ──────────────────────────────────────────────

function SpendingTrend({
  daily,
  days,
  onDaysChange,
  loading,
}: {
  daily: DailyPoint[];
  days: number;
  onDaysChange: (d: number) => void;
  loading: boolean;
}) {
  const chartData = daily.map((d) => ({
    date: d.day.slice(5), // "MM-DD"
    costCents: Number(d.costCents),
  }));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Spending Trend</h2>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                days === d
                  ? "bg-[#00B2FF] text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : chartData.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">No data for this period</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              formatter={(v) => [fmtDollars(Number(v ?? 0)), "Spend"]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              labelStyle={{ color: "#6b7280" }}
            />
            <Line
              type="monotone"
              dataKey="costCents"
              stroke="#00B2FF"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#00B2FF" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Benchmark card ─────────────────────────────────────────────────────────

function BenchmarkCard({
  benchmark,
  loading,
}: {
  benchmark: Insights["benchmark"] | null;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">How You Compare</h2>
      {loading || !benchmark ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-full mt-4" />
        </div>
      ) : benchmark.position === "unknown" ? (
        <p className="text-sm text-gray-400">No benchmark data available</p>
      ) : (
        <>
          <p className={`text-sm font-medium mb-1 ${
            benchmark.position === "above" ? "text-red-600" :
            benchmark.position === "below" ? "text-green-600" : "text-gray-700"
          }`}>
            {benchmark.label}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-gray-100 text-center">
            <div>
              <div className="text-sm font-semibold text-gray-800">{fmtDollars(benchmark.medianCents)}</div>
              <div className="text-xs text-gray-400">Tier median</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{fmtDollars(benchmark.yourCents30d)}</div>
              <div className="text-xs text-gray-400">Your spend (30d)</div>
            </div>
            <div>
              <div className={`text-sm font-semibold ${
                benchmark.ratio !== null && benchmark.ratio > 1 ? "text-red-500" : "text-green-600"
              }`}>
                {benchmark.ratio !== null ? `${benchmark.ratio}×` : "—"}
              </div>
              <div className="text-xs text-gray-400">vs median</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Recommendations ────────────────────────────────────────────────────────

function RecommendationsCard({
  recommendations,
  totalSavings,
  loading,
}: {
  recommendations: Recommendation[];
  totalSavings: number;
  loading: boolean;
}) {
  const priorityBadge: Record<string, string> = {
    high:   "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low:    "bg-gray-100 text-gray-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">
          {loading ? "Ways to Save" : `${recommendations.length} Ways to Save`}
        </h2>
        {!loading && totalSavings > 0 && (
          <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
            Up to {fmtDollars(totalSavings)}/mo
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">Looking good!</p>
          <p className="text-xs text-gray-400 mt-1">No cost recommendations at the moment.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-blue-50 text-[#00B2FF] text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800">{rec.title}</p>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge[rec.priority]}`}>
                    {rec.priority}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rec.detail}</p>
                <p className="text-xs font-semibold text-green-700 mt-1">
                  Save ~{fmtDollars(rec.potentialSavingsCents)}/month
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main dashboard component ───────────────────────────────────────────────

export function SpendingDashboard() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [connected, setConnected] = useState<ConnectedProvider[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (d: number) => {
    setLoadingSummary(true);
    setLoadingInsights(true);

    const [summaryRes, insightsRes, connectedRes] = await Promise.all([
      fetch(`/api/companies/me/usage-summary?days=${d}`),
      fetch(`/api/companies/me/insights?days=${d}`),
      fetch("/api/companies/me/connected-providers"),
    ]);

    if (summaryRes.ok) setSummary(await summaryRes.json());
    setLoadingSummary(false);

    if (insightsRes.ok) setInsights(await insightsRes.json());
    setLoadingInsights(false);

    if (connectedRes.ok) {
      const data = await connectedRes.json();
      setConnected(data.connected ?? []);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  async function handleRefresh() {
    if (syncing) return;
    setSyncing(true);
    toast("Syncing your data…");

    // Trigger sync for each connected provider
    try {
      await Promise.all(
        connected.map((p) =>
          fetch(`/api/providers/${p.providerId}/sync-usage`).catch(() => null),
        ),
      );
    } catch {
      // partial failure is fine, we'll just refetch
    }

    // Poll for updated data every 2s for up to 30s
    let attempts = 0;
    const prevCost = summary?.totals.costCents;
    pollRef.current = setInterval(async () => {
      attempts++;
      const res = await fetch(`/api/companies/me/usage-summary?days=${days}`);
      if (res.ok) {
        const data: UsageSummary = await res.json();
        const newCost = data.totals.costCents;
        if (newCost !== prevCost || attempts >= 15) {
          setSummary(data);
          // Also refresh insights
          const ins = await fetch(`/api/companies/me/insights?days=${days}`);
          if (ins.ok) setInsights(await ins.json());

          if (pollRef.current) clearInterval(pollRef.current);
          setSyncing(false);
          toast.success("Data updated!");
        }
      }
      if (attempts >= 15) {
        if (pollRef.current) clearInterval(pollRef.current);
        setSyncing(false);
        toast.success("Sync complete.");
      }
    }, 2000);
  }

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function handleDaysChange(d: number) {
    setDays(d);
  }

  const hasData = !loadingSummary && (summary?.totals.costCents ?? 0) > 0;
  const isEmpty = !loadingSummary && !loadingInsights && (summary?.totals.costCents ?? 0) === 0 && connected.length === 0;

  return (
    <div>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AI Spending</h1>
          <p className="text-sm text-gray-500 mt-1">Last {days} days · auto-syncs every hour</p>
        </div>
        <div className="flex items-center gap-3">
          {connected.length > 0 && (
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {syncing ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
              {syncing ? "Syncing…" : "Refresh Now"}
            </button>
          )}
          <Link
            href="/U/onboard"
            className="inline-flex items-center px-4 py-2.5 text-sm font-medium bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition whitespace-nowrap"
          >
            + Connect Provider
          </Link>
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────── */}
      {isEmpty && <EmptyState />}

      {/* ── Dashboard cards ───────────────────────────────── */}
      {!isEmpty && (
        <div className="space-y-6">
          {/* Row 1: Spending + Model breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SpendingCard
              totals={summary?.totals ?? null}
              trend={insights?.trend ?? null}
              days={days}
              loading={loadingSummary}
            />
            <ModelBreakdown
              breakdown={summary?.breakdown ?? []}
              loading={loadingSummary}
            />
          </div>

          {/* Row 2: Trend chart (full width) */}
          <SpendingTrend
            daily={summary?.daily ?? []}
            days={days}
            onDaysChange={handleDaysChange}
            loading={loadingSummary}
          />

          {/* Row 3: Benchmark + Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BenchmarkCard
              benchmark={insights?.benchmark ?? null}
              loading={loadingInsights}
            />
            <RecommendationsCard
              recommendations={insights?.recommendations ?? []}
              totalSavings={insights?.potentialSavingsCents ?? 0}
              loading={loadingInsights}
            />
          </div>

          {/* Row 4: Footer links */}
          <div className="flex items-center gap-4 pt-2">
            <Link href="/U/settings" className="text-sm text-gray-500 hover:text-gray-700 transition">
              Settings
            </Link>
            <span className="text-gray-300">·</span>
            <Link href="/U/onboard" className="text-sm text-gray-500 hover:text-gray-700 transition">
              Connect another provider
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AuditRow = {
  id:                  string;
  completedAt:         string;
  periodStart:         string | null;
  periodEnd:           string | null;
  totalSpendCents:     number | null;
  estimatedWasteCents: number | null;
  efficiencyScore:     number | null;
  providerName:        string;
  providerDisplayName: string;
};

type Provider = { name: string; displayName: string };

function fmtDollars(cents: number | null) {
  if (cents === null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtPeriod(start: string | null, end: string | null) {
  if (!start || !end) return "-";
  const s = new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const e = new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

function scoreColor(score: number | null) {
  if (score === null) return "text-gray-400";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

export function AuditLogClient({
  audits,
  providers,
}: {
  audits: AuditRow[];
  providers: Provider[];
}) {
  const router = useRouter();
  const [providerFilter, setProviderFilter] = useState("all");

  const filtered = providerFilter === "all"
    ? audits
    : audits.filter((a) => a.providerName === providerFilter);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">History of all spending audits run on your account</p>
        </div>
        <button
          onClick={() => router.refresh()}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
        >
          <option value="all">All Providers</option>
          {providers.map((p) => (
            <option key={p.name} value={p.name}>{p.displayName}</option>
          ))}
        </select>

        {providerFilter !== "all" && (
          <button
            onClick={() => setProviderFilter("all")}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">No audits yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Run your first audit from the Onboard page to see results here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Period audited</th>
                  <th className="px-4 py-3 font-medium text-right">Total spend</th>
                  <th className="px-4 py-3 font-medium text-right">Est. waste</th>
                  <th className="px-4 py-3 font-medium text-right">Efficiency</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtDate(row.completedAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 capitalize">
                      {row.providerDisplayName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtPeriod(row.periodStart, row.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {fmtDollars(row.totalSpendCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {fmtDollars(row.estimatedWasteCents)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${scoreColor(row.efficiencyScore)}`}>
                      {row.efficiencyScore !== null ? `${row.efficiencyScore}/100` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/audit/free?id=${row.id}`}
                        className="text-xs font-medium text-[#00B2FF] hover:underline whitespace-nowrap"
                      >
                        View report →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type LogRow = {
  id:           string;
  agentId:      string;
  agentName:    string;
  providerName: string;
  model:        string | null;
  tokensIn:     number;
  tokensOut:    number;
  costCents:    number | string | null;
  statusCode:   number | null;
  wasBlocked:   boolean;
  createdAt:    string;
};

type Agent = { id: string; name: string };

function fmtCost(cents: number | string | null) {
  if (cents === null || cents === undefined) return "-";
  const n = Number(cents);
  return `$${(n / 100).toFixed(4)}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function AuditLogClient({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [agentFilter,   setAgentFilter]   = useState(searchParams.get("agentId") ?? "all");
  const [blockedFilter, setBlockedFilter] = useState("all");
  const [startDate,     setStartDate]     = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (agentFilter   !== "all") params.set("agentId",    agentFilter);
    if (blockedFilter !== "all") params.set("wasBlocked", blockedFilter === "blocked" ? "true" : "false");
    if (startDate)               params.set("startDate",  startDate);

    try {
      const res  = await fetch(`/api/usage-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
    } finally {
      setLoading(false);
    }
  }, [agentFilter, blockedFilter, startDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Sync agentId filter to URL so links from agent detail page work
  useEffect(() => {
    const current = searchParams.get("agentId") ?? "all";
    if (current !== agentFilter) setAgentFilter(current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const blockedCount  = logs.filter((l) => l.wasBlocked).length;
  const allowedCount  = logs.filter((l) => !l.wasBlocked).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">All requests routed through the SynthForce proxy</p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Summary pills */}
      {!loading && logs.length > 0 && (
        <div className="flex gap-3 mb-4">
          <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
            {allowedCount} allowed
          </span>
          <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
            {blockedCount} blocked
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
        >
          <option value="all">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          value={blockedFilter}
          onChange={(e) => setBlockedFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
        >
          <option value="all">All requests</option>
          <option value="blocked">Blocked only</option>
          <option value="allowed">Allowed only</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
          placeholder="From date"
        />

        {(agentFilter !== "all" || blockedFilter !== "all" || startDate) && (
          <button
            onClick={() => { setAgentFilter("all"); setBlockedFilter("all"); setStartDate(""); router.push("/U/audit-log"); }}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-400 animate-pulse">Loading logs…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">No proxy requests logged yet.</p>
            <p className="text-xs text-gray-400 mt-1">Requests will appear here once agents route through their virtual keys.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium text-right">Tokens in</th>
                  <th className="px-4 py-3 font-medium text-right">Tokens out</th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.agentName}</td>
                    <td className="px-4 py-3 text-gray-600">{row.providerName}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{row.model ?? "-"}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{row.tokensIn.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{row.tokensOut.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{fmtCost(row.costCents)}</td>
                    <td className="px-4 py-3">
                      {row.wasBlocked ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Blocked</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          {row.statusCode ?? "OK"}
                        </span>
                      )}
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

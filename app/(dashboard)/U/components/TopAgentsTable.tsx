"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type TopAgentRow = {
  id: string;
  name: string;
  status: string;
  spendCents: number;
  budgetCents: number;
};

type SortKey = "name" | "status" | "spendCents" | "budget";
type SortDir = "asc" | "desc";

const STATUS_PILL: Record<string, string> = {
  active:      "bg-green-100 text-green-800",
  paused:      "bg-yellow-100 text-yellow-800",
  flagged:     "bg-red-100 text-red-800",
  deactivated: "bg-gray-100 text-gray-600",
};

function fmtDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block text-xs leading-none ${active ? "text-[#00B2FF]" : "text-gray-300"}`} aria-hidden="true">
      {active ? (dir === "asc" ? "▲" : "▼") : "▲▼"}
    </span>
  );
}

export function TopAgentsTable({ agents }: { agents: TopAgentRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("spendCents");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    return [...agents].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")       cmp = a.name.localeCompare(b.name);
      if (sortKey === "status")     cmp = a.status.localeCompare(b.status);
      if (sortKey === "spendCents") cmp = a.spendCents - b.spendCents;
      if (sortKey === "budget") {
        const pctA = a.budgetCents > 0 ? a.spendCents / a.budgetCents : -1;
        const pctB = b.budgetCents > 0 ? b.spendCents / b.budgetCents : -1;
        cmp = pctA - pctB;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [agents, sortKey, sortDir]);

  if (agents.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#00B2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">No spend data yet</p>
        <p className="text-xs text-gray-400 mb-4">Onboard an agent and connect an API key to see spend here.</p>
        <Link
          href="/U/onboard"
          className="inline-flex items-center px-4 py-2 bg-[#00B2FF] text-white text-xs font-medium rounded-lg hover:bg-[#00B2FF]/90 transition"
        >
          Onboard your first agent
        </Link>
      </div>
    );
  }

  function thProps(key: SortKey, align: "left" | "right" = "left") {
    return {
      onClick: () => toggleSort(key),
      className: `px-6 py-3 font-medium cursor-pointer select-none hover:text-gray-700 whitespace-nowrap ${align === "right" ? "text-right" : ""}`,
      "aria-sort": sortKey === key ? (sortDir === "asc" ? "ascending" as const : "descending" as const) : "none" as const,
    };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th {...thProps("name")}>
              Agent <SortIcon active={sortKey === "name"} dir={sortDir} />
            </th>
            <th {...thProps("status")}>
              Status <SortIcon active={sortKey === "status"} dir={sortDir} />
            </th>
            <th {...thProps("spendCents", "right")}>
              MTD Spend <SortIcon active={sortKey === "spendCents"} dir={sortDir} />
            </th>
            <th {...thProps("budget", "right")}>
              Budget <SortIcon active={sortKey === "budget"} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((agent) => {
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
  );
}

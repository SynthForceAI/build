"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface UpgradeRow {
  id: string;
  email: string;
  tier: string;
  status: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  contacted: "bg-blue-50 text-blue-700 border border-blue-200",
  converted: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  closed: "bg-gray-100 text-gray-400 border border-gray-200",
};

const NEXT_STATUSES: Record<string, { label: string; value: string }[]> = {
  pending: [{ label: "Mark Contacted", value: "contacted" }, { label: "Close", value: "closed" }],
  contacted: [{ label: "Mark Converted", value: "converted" }, { label: "Close", value: "closed" }],
  converted: [{ label: "Close", value: "closed" }],
  closed: [],
};

function StatusBadge({ id, initialStatus }: { id: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const actions = NEXT_STATUSES[status] ?? [];

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      await fetch(`/api/billing/upgrade-request/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}>
        {status}
      </span>
      {actions.map((a) => (
        <button
          key={a.value}
          onClick={() => updateStatus(a.value)}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-gray-700 underline disabled:opacity-40 transition"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export function UpgradeRequestsTable({ rows }: { rows: UpgradeRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-10 text-center text-sm text-gray-400">
        No upgrade requests yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Tier</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Requested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-900">{r.email}</td>
                <td className="px-5 py-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize bg-violet-50 text-violet-600 border border-violet-100">
                    {r.tier}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <StatusBadge id={r.id} initialStatus={r.status} />
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

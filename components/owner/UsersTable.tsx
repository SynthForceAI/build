"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface UserRow {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  tier: string;
  auditCount: number;
}

const TIER_STYLES: Record<string, string> = {
  free: "bg-gray-100 text-gray-500",
  starter: "bg-blue-50 text-[#00B2FF]",
  team: "bg-violet-50 text-violet-600",
  enterprise: "bg-amber-50 text-amber-600",
};

function TierCell({ userId, initialTier }: { userId: string; initialTier: string }) {
  const [tier, setTier] = useState(initialTier);
  const [loading, setLoading] = useState(false);

  async function promote(newTier: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/owner/users/${userId}/tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: newTier }),
      });
      if (res.ok) setTier(newTier);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TIER_STYLES[tier] ?? TIER_STYLES.free}`}>
        {tier}
      </span>
      {tier === "free" && (
        <button
          onClick={() => promote("starter")}
          disabled={loading}
          className="text-xs text-[#00B2FF] hover:underline disabled:opacity-40 transition"
        >
          {loading ? "..." : "Set Starter"}
        </button>
      )}
      {tier === "starter" && (
        <button
          onClick={() => promote("free")}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-gray-600 hover:underline disabled:opacity-40 transition"
        >
          {loading ? "..." : "Revoke"}
        </button>
      )}
    </div>
  );
}

export function UsersTable({ rows }: { rows: UserRow[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Plan</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Audits</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Signed Up</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Last Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-900">{u.email}</td>
                <td className="px-5 py-3">
                  <TierCell userId={u.id} initialTier={u.tier} />
                </td>
                <td className="px-5 py-3">
                  {u.auditCount > 0 ? (
                    <span className="font-semibold text-gray-900">{u.auditCount}</span>
                  ) : (
                    <span className="text-gray-300">0</span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {u.lastLoginAt
                    ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true })
                    : <span className="text-gray-300">Never</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-gray-400 py-10 text-sm">No users yet.</p>
        )}
      </div>
    </div>
  );
}

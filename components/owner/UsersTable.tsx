"use client";

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
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TIER_STYLES[u.tier] ?? TIER_STYLES.free}`}>
                    {u.tier}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {u.auditCount > 0 ? (
                    <span className="font-semibold text-gray-900">{u.auditCount}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
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

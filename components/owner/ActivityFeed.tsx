"use client";

import { formatDistanceToNow } from "date-fns";

interface ActivityRow {
  id: string;
  email: string;
  action: string;
  createdAt: string;
}

const ACTION_CONFIG: Record<string, { label: string; dot: string }> = {
  signup: { label: "Signed up", dot: "bg-emerald-400" },
  login: { label: "Logged in", dot: "bg-blue-400" },
  logout: { label: "Logged out", dot: "bg-gray-300" },
  upgrade_requested: { label: "Requested upgrade", dot: "bg-amber-400" },
};

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
        {rows.map((r) => {
          const cfg = ACTION_CONFIG[r.action] ?? { label: r.action, dot: "bg-gray-300" };
          return (
            <div key={r.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">
                  <span className="font-medium">{r.email}</span>
                </p>
                <p className="text-xs text-gray-400">{cfg.label}</p>
              </div>
              <p className="text-xs text-gray-400 shrink-0 pt-0.5">
                {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
              </p>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-center text-gray-400 py-10 text-sm">No activity yet.</p>
        )}
      </div>
    </div>
  );
}

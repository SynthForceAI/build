"use client";

/**
 * AgentStatusToggle — activate / pause button for a single agent row.
 *
 * WHY a Client Component?
 * The button triggers a POST request and must update the UI on response.
 * useState (loading flag) and useRouter (to refresh server data) are both
 * hooks — hooks require "use client".
 *
 * WHY router.refresh() instead of local state?
 * The agents table is rendered by a Server Component. After a status change
 * we want the whole table to reflect real DB state, not just optimistically
 * flip a local variable. router.refresh() re-runs the Server Component's
 * data fetch and re-renders the table in place — no full page reload needed.
 *
 * WHY only activate/pause, not deactivate?
 * Deactivation is a heavier action (implies offboarding) — it warrants its
 * own confirmation flow. This toggle only handles the day-to-day
 * active ↔ paused cycle.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  agentId: string;
  status: string;
};

export function AgentStatusToggle({ agentId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function transition(action: "activate" | "pause") {
    setLoading(true);
    try {
      await fetch(`/api/agents/${agentId}/${action}`, { method: "POST" });
      // Re-run the parent Server Component's Prisma query so the table
      // reflects the new status from the DB rather than stale props.
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // Active agent → offer Pause
  if (status === "active") {
    return (
      <button
        onClick={() => transition("pause")}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors disabled:opacity-40"
      >
        {loading ? "…" : "Pause"}
      </button>
    );
  }

  // Paused or deactivated agent → offer Activate
  if (status === "paused" || status === "deactivated") {
    return (
      <button
        onClick={() => transition("activate")}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-md border border-accent text-accent hover:bg-accent hover:text-white transition-colors disabled:opacity-40"
      >
        {loading ? "…" : "Activate"}
      </button>
    );
  }

  // Flagged agents need admin review — no self-service toggle
  return null;
}

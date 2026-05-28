"use client";

import { useEffect, useState } from "react";

type Agent = {
  id:             string;
  name:           string;
  providerName:   string;
  modelUsed:      string;
  status:         "pending" | "active" | "inactive";
  tasksMonitored: number;
  connectedAt:    string;
  department:     string | null;
};

type Props = {
  initialAgents: Agent[];
  refreshKey:    number;
};

const PROVIDER_LABELS: Record<string, string> = {
  openai:        "OpenAI",
  anthropic:     "Anthropic",
  "google-gemini": "Google Gemini",
  deepseek:      "Deepseek",
};

function StatusBadge({ status }: { status: Agent["status"] }) {
  const classes =
    status === "active"
      ? "bg-green-100 text-green-800"
      : status === "pending"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function RecentlyConnected({ initialAgents, refreshKey }: Props) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (refreshKey === 0) return;
    fetch("/api/api-keys/connected")
      .then((r) => r.json())
      .then((data) => {
        if (data.agents) setAgents(data.agents);
      })
      .catch(() => {});
  }, [refreshKey]);

  async function revoke(id: string) {
    setRevoking(id);
    setError(null);
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.detail ?? "Failed to revoke. Try again.");
        return;
      }
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Recently Connected</h2>
      <p className="text-sm text-gray-600 mb-6">
        All provider keys connected to your account.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {agents.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-10">
          No connected agents yet. Add your first one on the left.
        </div>
      ) : (
        <ul className="space-y-3">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="bg-gray-50 rounded-xl p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {agent.name}
                  </span>
                  <StatusBadge status={agent.status} />
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {PROVIDER_LABELS[agent.providerName] ?? agent.providerName}
                  {agent.modelUsed ? ` · ${agent.modelUsed}` : ""}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Connected {timeAgo(agent.connectedAt)}
                  {agent.tasksMonitored > 0
                    ? ` · ${agent.tasksMonitored.toLocaleString()} tasks monitored`
                    : ""}
                  {agent.department ? ` · ${agent.department}` : ""}
                </p>
              </div>
              <button
                onClick={() => revoke(agent.id)}
                disabled={revoking === agent.id}
                className="shrink-0 text-xs text-gray-400 hover:text-red-600 transition disabled:opacity-40"
                title="Revoke this connection"
              >
                {revoking === agent.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

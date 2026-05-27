"use client";

import { useState } from "react";
import { AgentStatusToggle } from "./agent-status-toggle";
import { AddAgentForm } from "./add-agent-form";

export type AgentRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  department: string | null;
  provider: string | null;
  model: string | null;
  spendCents: number;
  budgetCents: number;
  lastActiveAt: string | null; // ISO string — safe across server/client boundary
};

type Department = { id: string; name: string };
type Provider = { id: string; name: string; displayName: string };
type Model = { id: string; modelId: string; displayName: string; providerId: string };

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

const STATUS_PILL: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  flagged: "bg-red-100 text-red-800",
  deactivated: "bg-gray-100 text-gray-600",
};

export function AgentsClient({
  agents,
  departments,
  providers,
  models,
}: {
  agents: AgentRow[];
  departments: Department[];
  providers: Provider[];
  models: Model[];
}) {
  const [showModal, setShowModal] = useState(false);

  const activeCount = agents.filter((a) => a.status === "active").length;
  const pausedCount = agents.filter((a) => a.status === "paused").length;

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500 mt-1">
            {agents.length} total · {activeCount} active · {pausedCount} paused
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-transparent hover:text-[#00B2FF] border border-[#00B2FF] transition"
        >
          + Add Agent
        </button>
      </div>

      {/* ── Agent table ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {agents.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">No agents yet.</p>
            <p className="text-xs text-gray-400 mt-1 mb-6">
              Onboard your first AI agent to start tracking spend and status.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-transparent hover:text-[#00B2FF] border border-[#00B2FF] transition"
            >
              + Add Agent
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Spend</th>
                  <th className="px-4 py-3 font-medium text-right">Budget</th>
                  <th className="px-4 py-3 font-medium text-right">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const pct =
                    agent.budgetCents > 0
                      ? Math.round((agent.spendCents / agent.budgetCents) * 100)
                      : null;

                  const pill = STATUS_PILL[agent.status] ?? "bg-gray-100 text-gray-600";

                  const modelLabel =
                    agent.provider && agent.model
                      ? `${agent.provider} · ${agent.model}`
                      : agent.model ?? agent.provider ?? "—";

                  return (
                    <tr
                      key={agent.id}
                      className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        {agent.description && (
                          <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">
                            {agent.description}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {agent.department ?? <span className="text-gray-400">—</span>}
                      </td>

                      <td className="px-4 py-3 text-gray-600">{modelLabel}</td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-mono capitalize ${pill}`}
                        >
                          {agent.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-mono text-gray-900">
                        {fmtDollars(agent.spendCents)}
                      </td>

                      <td className="px-6 py-4 text-right text-gray-500">
                        {pct !== null ? (
                          <span className={pct >= 90 ? "text-red-600 font-medium" : ""}>
                            {pct}%
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right text-xs text-gray-400 whitespace-nowrap">
                        {agent.lastActiveAt ? fmtRelativeTime(agent.lastActiveAt) : "—"}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <AgentStatusToggle agentId={agent.id} status={agent.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Agent Modal ──────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">New Agent</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AddAgentForm
              departments={departments}
              providers={providers}
              models={models}
              onSuccess={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

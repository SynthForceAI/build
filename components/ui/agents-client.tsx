"use client";

import { useState } from "react";
import Link from "next/link";
import { AgentStatusToggle } from "./agent-status-toggle";
import { AddAgentForm } from "./add-agent-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DepartmentsClient } from "./departments-client";

export type AgentRow = {
  id: string;
  departmentId: string | null;
  name: string;
  description: string | null;
  status: string;
  department: string | null;
  provider: string | null;
  model: string | null;
  spendCents: number;
  budgetCents: number;
  lastActiveAt: string | null; // ISO string - safe across server/client boundary
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
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);
  const [deptUpdateError, setDeptUpdateError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const activeCount = agents.filter((a) => a.status === "active").length;
  const pausedCount = agents.filter((a) => a.status === "paused").length;

  const filtered = search.trim()
    ? agents.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.department ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (a.status ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : agents;

  async function updateDepartments(agentId: string, departmentId: string | null) {
    setSavingAgentId(agentId);
    setDeptUpdateError(null);
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId }),
      });
      if (response.ok) {
        toast.success("Department updated");
        router.refresh();
      } else {
        toast.error("Couldn't update department . Please try again.");
        setDeptUpdateError("Couldn't update department . Please try again..");
      }
    } catch {
      toast.error("Something went wrong. Please check your connection");
      setDeptUpdateError("Something went wrong. Please check your connection.");
    } finally {
      setSavingAgentId(null);
      setEditingAgentId(null);
    }
  }

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500 mt-1">
            {agents.length > 0
              ? `${agents.length} total · ${activeCount} active · ${pausedCount} paused`
              : "Connect your first agent to get started"}
          </p>
        </div>
        {agents.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-transparent hover:text-[#00B2FF] border border-[#00B2FF] transition"
          >
            + Add Agent
          </button>
        )}
      </div>

      {deptUpdateError && (
        <p className="mb-4 text-sm text-red-500">{deptUpdateError}</p>
      )}

      {/* ── Search ──────────────────────────────────────── */}
      {agents.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents by name, department, or status…"
            className="w-full sm:w-72 px-3 py-2 text-sm border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00B2FF]/40 focus:border-[#00B2FF]"
          />
        </div>
      )}

      {/* ── Agent table ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {agents.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#00B2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">No agents connected yet</p>
            <p className="text-xs text-gray-400 mb-6 max-w-xs">
              Connect an API provider first. Your agents will appear here automatically once linked.
            </p>
            <Link
              href="/U/onboard"
              className="px-4 py-2 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-[#00B2FF]/90 transition"
            >
              Connect your first agent
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-500">No agents match <span className="font-medium">&ldquo;{search}&rdquo;</span>.</p>
            <button onClick={() => setSearch("")} className="mt-2 text-xs text-[#00B2FF] hover:underline">Clear search</button>
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
                {filtered.map((agent) => {
                  const pct =
                    agent.budgetCents > 0
                      ? Math.round((agent.spendCents / agent.budgetCents) * 100)
                      : null;

                  const pill = STATUS_PILL[agent.status] ?? "bg-gray-100 text-gray-600";

                  const modelLabel =
                    agent.provider && agent.model
                      ? `${agent.provider} · ${agent.model}`
                      : agent.model ?? agent.provider ?? "-";

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
                        {editingAgentId === agent.id ? (
                          <select
                            autoFocus
                            disabled={savingAgentId === agent.id}
                            defaultValue={agent.departmentId ?? ""}
                            onChange={(e) => updateDepartments(agent.id, e.target.value || null)}
                            onBlur={() => setEditingAgentId(null)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">No department</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span
                            onClick={() => setEditingAgentId(agent.id)}
                            className="cursor-pointer hover:text-[#00B2FF] transition-colors"
                          >
                            {agent.department ?? <span className="text-gray-400">-</span>}
                          </span>
                        )}
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
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right text-xs text-gray-400 whitespace-nowrap">
                        {agent.lastActiveAt ? fmtRelativeTime(agent.lastActiveAt) : "-"}
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

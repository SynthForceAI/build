"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
// Swap the mock data below for a Prisma query result once the DB is wired.

export type AgentCardData = {
  id: string;
  name: string;
  role: string;        // e.g. "Lead Qualifier" — currently agent.name, map to role field later
  department: string;
  status: string;      // "active" | "paused" | "flagged" | "deactivated"
  spendCents: number;  // currentMonthSpendCents converted to number
  tasksCompleted: number; // placeholder — wire to usageLogs._count or similar
};

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  active:      "bg-green-500",
  paused:      "bg-yellow-500",
  flagged:     "bg-red-500",
  deactivated: "bg-gray-400",
  training:    "bg-blue-500",
};

const STATUS_PILL: Record<string, string> = {
  active:      "bg-green-100 text-green-800",
  paused:      "bg-yellow-100 text-yellow-800",
  flagged:     "bg-red-100 text-red-800",
  deactivated: "bg-gray-100 text-gray-600",
  training:    "bg-blue-100 text-blue-800",
};

function fmtCostPerTask(spendCents: number, tasks: number): string {
  if (tasks === 0) return "—";
  return `$${((spendCents / 100) / tasks).toFixed(2)}`;
}

// ── Agent Detail Modal ──────────────────────────────────────────────────────

function AgentModal({
  agent,
  onClose,
}: {
  agent: AgentCardData;
  onClose: () => void;
}) {
  const dot  = STATUS_DOT[agent.status]  ?? "bg-gray-400";
  const pill = STATUS_PILL[agent.status] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10"
        role="dialog"
        aria-modal="true"
        aria-label={`${agent.name} details`}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full shrink-0 ${dot}`} />
            <h2 className="text-lg font-bold text-gray-900">{agent.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <Row label="Role"       value={agent.role} />
          <Row label="Department" value={agent.department} />
          <Row label="Status">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${pill}`}>
              {agent.status}
            </span>
          </Row>
          <Row label="Cost / Task" value={fmtCostPerTask(agent.spendCents, agent.tasksCompleted)} />
          <Row label="Tasks Completed" value={agent.tasksCompleted.toLocaleString()} />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Close
          </button>
          <a
            href={`/LoginDashboard/agents`}
            className="flex-1 px-4 py-2.5 text-sm text-center bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition"
          >
            Edit Agent
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      {children ?? <span className="font-medium text-gray-900">{value}</span>}
    </div>
  );
}

// ── Agent Grid ──────────────────────────────────────────────────────────────

export function AgentGrid({ agents }: { agents: AgentCardData[] }) {
  const [selected, setSelected] = useState<AgentCardData | null>(null);

  if (agents.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">No agents yet.</p>
        <p className="text-xs text-gray-400 mt-1">
          Go to{" "}
          <a href="/LoginDashboard/onboard" className="text-[#00B2FF] underline">
            Onboard
          </a>{" "}
          to add your first agent.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => {
          const dot  = STATUS_DOT[agent.status]  ?? "bg-gray-400";
          const pill = STATUS_PILL[agent.status] ?? "bg-gray-100 text-gray-600";
          return (
            <button
              key={agent.id}
              onClick={() => setSelected(agent)}
              className="bg-white border border-gray-200 rounded-xl p-6 text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#00B2FF]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${dot}`} />
                  <span className="font-bold text-gray-900 truncate">{agent.name}</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize shrink-0 ml-2 ${pill}`}>
                  {agent.status}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-1.5">Role: {agent.role}</div>
              <div className="text-sm text-gray-600 mb-1.5">Dept: {agent.department}</div>
              <div className="text-sm font-mono text-gray-900">
                Cost/task: {fmtCostPerTask(agent.spendCents, agent.tasksCompleted)}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Tasks: {agent.tasksCompleted.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <AgentModal agent={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
// Replace mock data below with real API call / Prisma query when ready.

export type ErrorItem = {
  agent: string;
  description: string;
  timeAgo: string;
};

export type AgentOption = {
  id: string;
  name: string;
  department: string | null;
};

// ── Mock error data ────────────────────────────────────────────────────────
// TODO: wire to usageLogs where statusCode >= 400 or a dedicated errors table

const MOCK_ERRORS: ErrorItem[] = [
  {
    agent: "Invoice Processor",
    description: "Failed to parse invoice date; manual review required.",
    timeAgo: "2 hours ago",
  },
  {
    agent: "Support Agent",
    description: "Customer query escalated incorrectly; routed to wrong department.",
    timeAgo: "5 hours ago",
  },
  {
    agent: "Lead Qualifier",
    description: "Duplicate lead entry; system flagged as duplicate but agent proceeded.",
    timeAgo: "1 day ago",
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export function ErrorDeepDive({ agents }: { agents: AgentOption[] }) {
  const [transferAgent, setTransferAgent] = useState(agents[0]?.id ?? "");
  const [targetDept, setTargetDept]       = useState("Marketing");
  const [reason, setReason]               = useState("");

  const inputClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent";

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-3">Error Deep Dive</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent errors list */}
        <div className="bg-red-50 p-6 rounded-xl">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Errors</h3>
          {MOCK_ERRORS.length === 0 ? (
            <p className="text-sm text-gray-500">No recent errors — all agents are healthy.</p>
          ) : (
            <ul className="space-y-4">
              {MOCK_ERRORS.map((err, i) => (
                <li key={i} className="flex gap-3">
                  <div className="w-1.5 shrink-0 bg-red-400 rounded-full mt-1" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{err.agent}</p>
                    <p className="text-sm text-gray-700 mt-0.5">{err.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{err.timeAgo}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Transfer agent form */}
        <div className="bg-gray-50 p-6 rounded-xl">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Transfer Agent</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Agent</label>
              <select
                value={transferAgent}
                onChange={(e) => setTransferAgent(e.target.value)}
                className={inputClass}
              >
                {agents.length === 0 ? (
                  <option value="">No agents available</option>
                ) : (
                  agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.department ? ` (${a.department})` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Department</label>
              <select
                value={targetDept}
                onChange={(e) => setTargetDept(e.target.value)}
                className={inputClass}
              >
                {["Marketing", "Sales", "Support", "Finance", "Operations"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Transfer</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputClass}
                rows={2}
                placeholder="e.g., Marketing needs lead data for campaign analysis"
              />
            </div>
            <button
              onClick={() => alert("Transfer initiated (demo — wire to PUT /api/agents/:id in production)")}
              className="w-full py-3 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition text-sm font-medium"
            >
              Initiate Transfer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

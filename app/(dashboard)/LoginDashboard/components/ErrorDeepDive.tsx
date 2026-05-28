"use client";

import { useState } from "react";

export type AgentOption = {
  id: string;
  name: string;
  department: string | null;
};

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

        {/* Recent errors — empty state until usageLogs are wired */}
        <div className="bg-gray-50 p-6 rounded-xl">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Errors</h3>
          <p className="text-sm text-gray-500">No errors recorded yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Errors will appear here once agents have usage data.
          </p>
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
              onClick={() => alert("Transfer initiated — wire to PUT /api/agents/:id")}
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

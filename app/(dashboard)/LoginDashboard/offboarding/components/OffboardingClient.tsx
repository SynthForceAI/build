"use client";

import { useState } from "react";
import type { ActiveAgentOption } from "../page";

const inputClass =
  "w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent";

export function OffboardingClient({ activeAgents }: { activeAgents: ActiveAgentOption[] }) {
  const [selectedId, setSelectedId] = useState(activeAgents[0]?.id ?? "");
  const [reason, setReason]         = useState("");
  const [finalDate, setFinalDate]   = useState("");
  const [notes, setNotes]           = useState("");
  const [submitted, setSubmitted]   = useState(false);

  if (submitted) {
    return (
      <div className="bg-green-50 p-6 rounded-xl flex flex-col items-center justify-center text-center min-h-[320px]">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Offboarding Initiated</h3>
        <p className="text-sm text-gray-600 mb-5">
          The agent has been queued for deactivation. Access will be revoked on the final access date.
        </p>
        <button
          onClick={() => { setSubmitted(false); setReason(""); setFinalDate(""); setNotes(""); }}
          className="text-sm text-[#00B2FF] hover:underline"
        >
          Offboard another agent
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900 mb-1">Offboard an Agent</h3>
      <p className="text-xs text-gray-500 mb-5">
        Select an active agent to begin the offboarding process.
      </p>

      {activeAgents.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No active agents to offboard.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Agent</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={inputClass}
            >
              {activeAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.department ? ` (${a.department})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Offboarding</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a reason…</option>
              <option value="project_complete">Project completed</option>
              <option value="replaced">Replaced by a newer agent</option>
              <option value="budget">Budget reduction</option>
              <option value="performance">Performance issues</option>
              <option value="compliance">Compliance / policy violation</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Final Access Date</label>
            <input
              type="date"
              value={finalDate}
              onChange={(e) => setFinalDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              rows={3}
              placeholder="Any additional context for the audit trail…"
            />
          </div>

          <button
            disabled={!reason || !finalDate}
            onClick={() => setSubmitted(true)}
            // TODO: wire to PUT /api/agents/:id { status: "deactivated" }
            className="w-full py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Complete Offboarding
          </button>
        </div>
      )}
    </div>
  );
}

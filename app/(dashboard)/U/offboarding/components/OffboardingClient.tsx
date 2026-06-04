"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActiveAgentOption } from "../page";

const inputClass =
  "w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent";

export function OffboardingClient({ activeAgents }: { activeAgents: ActiveAgentOption[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(activeAgents[0]?.id ?? "");
  const [reason, setReason]         = useState("");
  const [finalDate, setFinalDate]   = useState("");
  const [notes, setNotes]           = useState("");
  const [submitted, setSubmitted]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectedAgent = activeAgents.find((a) => a.id === selectedId);

  async function handleOffBoard() {
    setLoading(true);
    setConfirming(false);
    try {
      const response = await fetch(`/api/agents/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "deactivated" }),
      });
      if (!response.ok) throw new Error("request failed");
      toast.success(`${selectedAgent?.name ?? "Agent"} has been offboarded`);
      router.refresh();
      setSubmitted(true);
    } catch {
      toast.error("Failed to offboard agent — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-green-50 p-6 rounded-xl flex flex-col items-center justify-center text-center min-h-[320px]">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Offboard an Agent</h3>
        <p className="text-xs text-gray-500 mb-5">
          Select an active agent to begin the offboarding process. This action is irreversible.
        </p>

        {activeAgents.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">No active agents</p>
            <p className="text-xs text-gray-500">All agents have already been offboarded or there are none to manage.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="offboard-agent" className="block text-sm font-medium text-gray-700 mb-1">Select Agent</label>
              <select
                id="offboard-agent"
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
              <label htmlFor="offboard-reason" className="block text-sm font-medium text-gray-700 mb-1">Reason for Offboarding</label>
              <select
                id="offboard-reason"
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
              <label htmlFor="offboard-date" className="block text-sm font-medium text-gray-700 mb-1">Final Access Date</label>
              <input
                id="offboard-date"
                type="date"
                value={finalDate}
                onChange={(e) => setFinalDate(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="offboard-notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="offboard-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
                rows={3}
                placeholder="Any additional context for the audit trail…"
              />
            </div>

            <button
              disabled={!reason || !finalDate || loading}
              onClick={() => setConfirming(true)}
              className="w-full py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Processing…" : "Complete Offboarding"}
            </button>
          </div>
        )}
      </div>

      {/* ── Confirmation dialog ─────────────────────────────── */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirming(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 z-10">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h2 id="confirm-title" className="text-base font-semibold text-gray-900">Confirm offboarding</h2>
                <p className="text-sm text-gray-500 mt-1">
                  You're about to permanently deactivate <strong>{selectedAgent?.name}</strong>. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleOffBoard}
                disabled={loading}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-40"
              >
                {loading ? "Processing…" : "Yes, offboard"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

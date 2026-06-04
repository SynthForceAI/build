"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AgentOption = {
  id: string;
  name: string;
  department: string | null;
};

export type DepartmentOption = {
  id: string;
  name: string;
};

export function ErrorDeepDive({
  agents,
  departments,
}: {
  agents: AgentOption[];
  departments: DepartmentOption[];
}) {
  const [transferAgent, setTransferAgent] = useState(agents[0]?.id ?? "");
  const [targetDept, setTargetDept]       = useState(departments[0]?.id ?? "");
  const [reason, setReason]               = useState("");
  const [saving, setSaving]               = useState(false);
  const [feedback, setFeedback]           = useState<{ ok: boolean; msg: string } | null>(null);
  const router = useRouter();

  async function handleTransfer() {
    if (!transferAgent || !targetDept) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/agents/${transferAgent}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: targetDept }),
      });
      if (!res.ok) throw new Error("Transfer failed");
      setFeedback({ ok: true, msg: "Agent transferred successfully." });
      router.refresh();
    } catch {
      setFeedback({ ok: false, msg: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent";

  return (
    <div className="border-t border-gray-200 pt-8">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Error Deep Dive</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent errors — empty state until usageLogs are wired */}
        <div className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Errors</h3>
          <p className="text-sm text-gray-500">No errors recorded yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Errors will appear here once agents have usage data.
          </p>
        </div>

        {/* Transfer agent form */}
        <div className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
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
                {departments.length === 0 ? (
                  <option value="">No departments created</option>
                ) : (
                  departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))
                )}
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
            {feedback && (
              <p className={`text-xs ${feedback.ok ? "text-green-600" : "text-red-500"}`}>
                {feedback.msg}
              </p>
            )}
            <button
              onClick={handleTransfer}
              disabled={saving || !transferAgent || !targetDept}
              className="w-full py-3 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Transferring…" : "Initiate Transfer"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

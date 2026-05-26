"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddDepartmentForm } from "./add-department-form";

export type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  agentCount: number;
  spendCents: number;
  budgetCents: number;
};

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function DepartmentsClient({ departments }: { departments: DepartmentRow[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  // inline budget editing
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<{ id: string; message: string } | null>(null);
  // prevents onBlur from saving when Escape closed the input
  const escapedRef = useRef(false);

  async function handleBudgetSave(id: string) {
    if (escapedRef.current) {
      escapedRef.current = false;
      setEditingId(null);
      return;
    }
    const cents =
      draftValue.trim() === "" ? 0 : Math.round(parseFloat(draftValue) * 100);
    if (isNaN(cents) || cents < 0) { setEditingId(null); return; }
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/departments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyBudgetCents: cents }),
    });
    setSaving(false);
    setEditingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaveError({ id, message: body?.error?.message ?? "Could not save budget." });
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-500 mt-1">
            {departments.length} {departments.length === 1 ? "department" : "departments"}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-transparent hover:text-[#00B2FF] border border-[#00B2FF] transition"
        >
          + Add Department
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {departments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">No departments yet.</p>
            <p className="text-xs text-gray-400 mt-1 mb-6">
              Create a department to start organizing your agents and tracking spend.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-transparent hover:text-[#00B2FF] border border-[#00B2FF] transition"
            >
              + Add Department
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Agents</th>
                  <th className="px-6 py-3 font-medium text-right">MTD Spend</th>
                  <th className="px-6 py-3 font-medium text-right">Monthly Budget</th>
                  <th className="px-6 py-3 font-medium text-right">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  const pct =
                    dept.budgetCents > 0
                      ? Math.round((dept.spendCents / dept.budgetCents) * 100)
                      : null;

                  let utilizationEl: React.ReactNode;
                  if (pct === null) {
                    utilizationEl = <span className="text-gray-400">—</span>;
                  } else if (pct > 100) {
                    utilizationEl = <span className="text-red-600 font-medium">Over budget</span>;
                  } else {
                    const color =
                      pct >= 90
                        ? "text-red-600 font-medium"
                        : pct >= 75
                        ? "text-yellow-600"
                        : "text-gray-700";
                    utilizationEl = <span className={color}>{pct}%</span>;
                  }

                  return (
                    <tr
                      key={dept.id}
                      className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{dept.name}</p>
                        {dept.description && (
                          <p className="text-xs text-gray-400 mt-0.5 max-w-[240px] truncate">
                            {dept.description}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-700">
                          {dept.agentCount} {dept.agentCount === 1 ? "agent" : "agents"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-mono text-gray-900">
                        {fmtDollars(dept.spendCents)}
                      </td>

                      <td className="px-6 py-4 text-right font-mono">
                        {editingId === dept.id ? (
                          <input
                            type="number"
                            autoFocus
                            min="0"
                            value={draftValue}
                            disabled={saving}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onBlur={() => handleBudgetSave(dept.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") {
                                escapedRef.current = true;
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-28 px-2 py-1 border border-[#00B2FF] rounded-lg text-sm text-right font-mono focus:outline-none disabled:opacity-50"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSaveError(null);
                              setDraftValue(
                                dept.budgetCents > 0 ? String(dept.budgetCents / 100) : ""
                              );
                              setEditingId(dept.id);
                            }}
                            className="text-gray-500 hover:text-gray-900 transition-colors"
                            title="Click to edit budget"
                          >
                            {dept.budgetCents > 0
                              ? `${fmtDollars(dept.budgetCents)}/mo`
                              : <span className="text-gray-400">No cap</span>}
                          </button>
                        )}
                        {saveError?.id === dept.id && (
                          <p className="text-xs text-red-500 mt-1">{saveError.message}</p>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">{utilizationEl}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Department Modal ─────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">New Department</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AddDepartmentForm onSuccess={() => setShowModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

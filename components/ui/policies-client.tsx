"use client";

import { useState } from "react";
import { AddPolicyForm } from "./add-policy-form";

type Policy = {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  departmentId: string | null;
  severity: string;
  scope: string;
};

type Department = { id: string; name: string };

const SEVERITY_PILL: Record<string, string> = {
  warning: "bg-yellow-100 text-yellow-800",
  block: "bg-red-100 text-red-800",
  flag: "bg-orange-100 text-orange-800",
  log: "bg-gray-100 text-gray-600",
};

export function PoliciesClient({
  policies,
  departments,
}: {
  policies: Policy[];
  departments: Department[];
}) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);

  const filtered = policies.filter((p) => {
    const severityMatch = severityFilter === "all" || p.severity === severityFilter;
    const departmentMatch =
      departmentFilter === "all" ||
      (departmentFilter === "global" ? p.departmentId === null : p.departmentId === departmentFilter);
    return severityMatch && departmentMatch;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Policies</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-transparent hover:text-[#00B2FF] border border-[#00B2FF] transition"
        >
          + Add Policy
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4">
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
        >
          <option value="all">All Departments</option>
          <option value="global">Global</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
        >
          <option value="all">All Severities</option>
          <option value="warning">Warning</option>
          <option value="block">Block</option>
          <option value="flag">Flag</option>
          <option value="log">Log</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">
              {policies.length === 0 ? "No policies created yet." : "No policies match the selected filters."}
            </p>
            <p className="text-xs text-gray-400 mt-1 mb-6">
              {policies.length === 0 ? "Create a new policy for your AI Agents" : "Try adjusting the filters above."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Department</th>
                  <th className="px-6 py-3 font-medium">Severity</th>
                  <th className="px-6 py-3 font-medium">Scope</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((policy) => (
                  <tr
                    key={policy.id}
                    className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{policy.name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{policy.description}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{policy.department ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-mono capitalize ${SEVERITY_PILL[policy.severity] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {policy.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{policy.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Policy Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">New Policy</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AddPolicyForm
              departments={departments}
              onSuccess={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Department = { id: string; name: string };
type Provider = { id: string; name: string; displayName: string };
type Model = { id: string; modelId: string; displayName: string; providerId: string };

export function AddAgentForm({
  departments: initialDepartments,
  providers,
  models,
  onSuccess,
}: {
  departments: Department[];
  providers: Provider[];
  models: Model[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [departmentId, setDepartmentId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [monthlyBudgetDollars, setMonthlyBudgetDollars] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // inline department creation
  const [showNewDept, setShowNewDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptLoading, setNewDeptLoading] = useState(false);
  const [newDeptError, setNewDeptError] = useState<string | null>(null);

  // filter models based on selected provider
  const filteredModels = models.filter((m) => m.providerId === providerId);

  async function handleCreateDepartment() {
    if (!newDeptName.trim()) return;
    setNewDeptLoading(true);
    setNewDeptError(null);
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDeptName.trim() }),
    });
    setNewDeptLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setNewDeptError(body?.error?.message ?? "Could not create department.");
      return;
    }
    const { department } = await res.json();
    setDepartments((prev) => [...prev, { id: department.id, name: department.name }]);
    setDepartmentId(department.id);
    setNewDeptName("");
    setShowNewDept(false);
  }

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    setError(null);
    const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          departmentId: departmentId || undefined,
          providerId: providerId || undefined,
          modelId: modelId || undefined,
          monthlyBudgetCents: monthlyBudgetDollars
            ? Math.round(parseFloat(monthlyBudgetDollars) * 100)
            : undefined,
        }),
      });

      setLoading(false);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.refresh();
      onSuccess?.();
  }
  return(
    <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="e.g. Training Model, Research Model"
            />
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Plain English description of the Agent's roles"
            />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select
            value={departmentId}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setShowNewDept(true);
                setDepartmentId("");
              } else {
                setShowNewDept(false);
                setDepartmentId(e.target.value);
              }
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
            <option value="__new__">+ New Department</option>
          </select>

          {showNewDept && (
            <div className="mt-2 flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="Department name"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateDepartment())}
                />
                {newDeptError && (
                  <p className="text-xs text-red-600 mt-1">{newDeptError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCreateDepartment}
                disabled={newDeptLoading || !newDeptName.trim()}
                className="px-3 py-1.5 bg-[#00B2FF] text-white rounded-lg text-sm font-medium border border-[#00B2FF] hover:bg-transparent hover:text-[#00B2FF] transition disabled:opacity-50 whitespace-nowrap"
              >
                {newDeptLoading ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setShowNewDept(false); setNewDeptName(""); setNewDeptError(null); }}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
                value={providerId}
                onChange={(e) => {
                setProviderId(e.target.value);
                setModelId("");
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
                <option value="">Select provider (optional)</option>
                {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
            </select>
        </div>
        {providerId !== "" && (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
            <option value="">Select model (optional)</option>
            {filteredModels.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
            </select>
        </div>
        )}

        <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget ($)</label>
        <input
            type="number"
            value={monthlyBudgetDollars}
            onChange={(e) => setMonthlyBudgetDollars(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="e.g. 500"
        />
        </div>
        

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-transparent hover:text-[#00B2FF] border border-[#00B2FF] transition disabled:opacity-50"
        >
            {loading ? "Adding..." : "Add Agent"}
        </button>

    </form>
  )
}
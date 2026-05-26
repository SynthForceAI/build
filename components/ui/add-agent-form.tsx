"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Department = { id: string; name: string };
type Provider = { id: string; name: string; displayName: string };
type Model = { id: string; modelId: string; displayName: string; providerId: string };

export function AddAgentForm({
  departments,
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
  const [departmentId, setDepartmentId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [monthlyBudgetDollars, setMonthlyBudgetDollars] = useState("");
  const [loading, setLoading] = useState(false);

  // filter models based on selected provider
  const filteredModels = models.filter((m) => m.providerId === providerId);

  // your submit function and JSX goes here
  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch("/api/agents", {
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
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
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
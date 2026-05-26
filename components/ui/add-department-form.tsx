"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddDepartmentForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyBudgetDollars, setMonthlyBudgetDollars] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="e.g. Engineering, Sales, Finance"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="What does this department do? (optional)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget ($)</label>
        <input
          type="number"
          value={monthlyBudgetDollars}
          onChange={(e) => setMonthlyBudgetDollars(e.target.value)}
          min="0"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="e.g. 5000 (leave blank for no cap)"
        />
        <p className="text-xs text-gray-400 mt-1">Leave blank to set no budget cap.</p>
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
        {loading ? "Creating..." : "Create Department"}
      </button>
    </form>
  );
}

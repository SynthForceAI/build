"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddPolicyForm({
  departments,
  onSuccess,
}: {
  departments: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const router = useRouter();

  // shared fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [scope, setScope] = useState("global");
  const [scopeDepartmentId, setScopeDepartmentId] = useState("");
  const [ruleType, setRuleType] = useState("content_guard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // content_guard fields
  const [blockedTerms, setBlockedTerms] = useState("");

  // budget fields
  const [budgetValueDollars, setBudgetValueDollars] = useState("");

  // rate_limit fields
  const [perMinute, setPerMinute] = useState("");
  const [perHour, setPerHour] = useState("");
  const [perDay, setPerDay] = useState("");

  // time_restriction fields
  const [timezone, setTimezone] = useState("America/New_York");
  const [allowedHours, setAllowedHours] = useState("");

  // model_restriction fields
  const [allowedModelIds, setAllowedModelIds] = useState("");

  // department_isolation fields
  const [allowedDepartmentIds, setAllowedDepartmentIds] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    let ruleDefinition: object;
    if (ruleType === "content_guard") {
      ruleDefinition = {
        type: "content_guard",
        blockedTerms: blockedTerms.split(",").map((t) => t.trim()).filter(Boolean),
      };
    } else if (ruleType === "budget") {
      ruleDefinition = {
        type: "budget",
        operator: "less_than_or_equal",
        field: "monthly_spend",
        valueCents: Math.round(parseFloat(budgetValueDollars) * 100),
      };
    } else if (ruleType === "rate_limit") {
      ruleDefinition = {
        type: "rate_limit",
        ...(perMinute && { perMinute: parseInt(perMinute) }),
        ...(perHour && { perHour: parseInt(perHour) }),
        ...(perDay && { perDay: parseInt(perDay) }),
      };
    } else if (ruleType === "time_restriction") {
      ruleDefinition = {
        type: "time_restriction",
        timezone,
        allowedHours: allowedHours.split(",").map((h) => parseInt(h.trim())).filter((h) => !isNaN(h)),
      };
    } else if (ruleType === "model_restriction") {
      ruleDefinition = {
        type: "model_restriction",
        allowedModelIds: allowedModelIds.split(",").map((id) => id.trim()).filter(Boolean),
      };
    } else {
      ruleDefinition = {
        type: "department_isolation",
        allowedDepartmentIds: allowedDepartmentIds.split(",").map((id) => id.trim()).filter(Boolean),
      };
    }

    setError(null);
    const res = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        severity,
        scope,
        scopeDepartmentId: scope === "department" ? scopeDepartmentId : undefined,
        ruleDefinition,
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
          placeholder="e.g. No discounts without approval"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="Plain English description of the policy"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="warning">Warning</option>
          <option value="block">Block</option>
          <option value="flag">Flag</option>
          <option value="log">Log</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
        <select value={scope} onChange={(e) => setScope(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="global">Global</option>
          <option value="department">Department</option>
        </select>
      </div>

      {scope === "department" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select value={scopeDepartmentId} onChange={(e) => setScopeDepartmentId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rule Type</label>
        <select value={ruleType} onChange={(e) => setRuleType(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="content_guard">Content Guard</option>
          <option value="budget">Budget</option>
          <option value="rate_limit">Rate Limit</option>
          <option value="time_restriction">Time Restriction</option>
          <option value="model_restriction">Model Restriction</option>
          <option value="department_isolation">Department Isolation</option>
        </select>
      </div>

      {ruleType === "content_guard" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Blocked Terms</label>
          <input
            type="text"
            value={blockedTerms}
            onChange={(e) => setBlockedTerms(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="e.g. discount, refund, promise (comma separated)"
          />
        </div>
      )}

      {ruleType === "budget" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Spend Limit ($)</label>
          <input
            type="number"
            value={budgetValueDollars}
            onChange={(e) => setBudgetValueDollars(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="e.g. 500"
          />
        </div>
      )}

      {ruleType === "rate_limit" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requests per Minute</label>
            <input
              type="number"
              value={perMinute}
              onChange={(e) => setPerMinute(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. 10 (leave blank to skip)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requests per Hour</label>
            <input
              type="number"
              value={perHour}
              onChange={(e) => setPerHour(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. 100 (leave blank to skip)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requests per Day</label>
            <input
              type="number"
              value={perDay}
              onChange={(e) => setPerDay(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. 500 (leave blank to skip)"
            />
          </div>
        </div>
      )}

      {ruleType === "time_restriction" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. America/New_York"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Hours (0–23)</label>
            <input
              type="text"
              value={allowedHours}
              onChange={(e) => setAllowedHours(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. 9, 10, 11, 12, 13, 14, 17 (comma separated)"
            />
          </div>
        </div>
      )}

      {ruleType === "model_restriction" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Model IDs</label>
          <input
            type="text"
            value={allowedModelIds}
            onChange={(e) => setAllowedModelIds(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="e.g. gpt-4o-mini, gpt-3.5-turbo (comma separated)"
          />
        </div>
      )}

      {ruleType === "department_isolation" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Department IDs</label>
          <input
            type="text"
            value={allowedDepartmentIds}
            onChange={(e) => setAllowedDepartmentIds(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="e.g. dept-uuid-1, dept-uuid-2 (comma separated)"
          />
        </div>
      )}

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
        {loading ? "Saving..." : "Save Policy"}
      </button>
    </form>
  );
}

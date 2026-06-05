"use client";

import { useState } from "react";
import { FieldHelp } from "@/components/ui/field-help";

type Provider = { id: string; name: string; displayName: string };
type Department = { id: string; name: string };

type Props = {
  providers:   Provider[];
  departments: Department[];
  onSuccess:   () => void;
};

type FormState = {
  providerId:   string;
  apiKey:       string;
  agentName:    string;
  departmentId: string;
  keyType:      "personal" | "admin";
};

type Banner =
  | { type: "success"; message: string }
  | { type: "error";   message: string }
  | null;

export function ProviderForm({ providers, departments, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>({
    providerId:   "",
    apiKey:       "",
    agentName:    "",
    departmentId: "",
    keyType:      "personal",
  });
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const selectedProvider = providers.find((p) => p.id === form.providerId);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setBanner(null);
  }

  function setKeyType(value: "personal" | "admin") {
    setForm((prev) => ({ ...prev, keyType: value }));
    setBanner(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);

    if (!form.providerId) return setBanner({ type: "error", message: "Please select a provider." });
    if (form.apiKey.length < 10) return setBanner({ type: "error", message: "API key must be at least 10 characters." });
    if (form.agentName.trim().length < 3) return setBanner({ type: "error", message: "Agent name must be at least 3 characters." });

    setLoading(true);
    try {
      const body: Record<string, string> = {
        providerId: form.providerId,
        apiKey:     form.apiKey,
        agentName:  form.agentName.trim(),
        keyType:    form.keyType,
      };
      if (form.departmentId) body.departmentId = form.departmentId;

      const res = await fetch("/api/api-keys/connect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.detail ?? data?.error?.message ?? "Connection failed. Try again.";
        setBanner({ type: "error", message: msg });
        return;
      }

      setBanner({
        type:    "success",
        message: `Connected! ${data.name} (${selectedProvider?.displayName ?? form.providerId}) is now active.`,
      });
      setForm({ providerId: "", apiKey: "", agentName: "", departmentId: "", keyType: "personal" });
      onSuccess();
    } catch {
      setBanner({ type: "error", message: "Network error. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">API Integration</h2>
      <p className="text-sm text-gray-600 mb-6">
        Connect a provider API key to bring an agent into SynthForce.
      </p>

      {banner && (
        <div
          className={
            banner.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm mb-5"
              : "bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm mb-5"
          }
        >
          {banner.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Provider */}
        <div>
          <label htmlFor="providerId" className={`${labelClass} flex items-center`}>
            Provider <span className="text-red-500 ml-0.5">*</span>
            <FieldHelp text="The AI platform that runs your agent — e.g. OpenAI, Anthropic, or Google. SynthForce connects to their API using your key." />
          </label>
          <select
            id="providerId"
            value={form.providerId}
            onChange={(e) => {
              set("providerId", e.target.value);
              setKeyType("personal"); // reset when provider changes
            }}
            disabled={loading}
            className={inputClass}
            required
          >
            <option value="">Select provider…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        {/* Key Type — only OpenAI and Anthropic have org-level usage APIs */}
        {(selectedProvider?.name === "openai" || selectedProvider?.name === "anthropic") && (
        <div>
          <label className={`${labelClass} flex items-center`}>
            Key Type
            <FieldHelp text="Personal keys (sk-…) work for agent activity tracking. Organization Admin keys (sk-admin-… or sk-org-…) also enable automatic billing sync — SynthForce will poll your provider's usage API hourly to keep spend data current." />
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["personal", "admin"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setKeyType(type)}
                disabled={loading}
                className={`px-4 py-3 rounded-lg border text-sm font-medium text-left transition-colors ${
                  form.keyType === type
                    ? "border-[#00B2FF] bg-blue-50 text-[#00B2FF]"
                    : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                } disabled:opacity-50`}
              >
                {type === "personal" ? (
                  <>
                    <span className="block font-semibold">Personal API Key</span>
                    <span className="text-xs mt-0.5 block font-normal opacity-70">
                      sk-… · agent activity only
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block font-semibold">Organization Admin Key</span>
                    <span className="text-xs mt-0.5 block font-normal opacity-70">
                      sk-admin-… · enables billing sync
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* API Key */}
        <div>
          <label htmlFor="apiKey" className={`${labelClass} flex items-center`}>
            API Key <span className="text-red-500 ml-0.5">*</span>
            <FieldHelp
              text={
                form.keyType === "admin"
                  ? selectedProvider?.name === "openai"
                    ? "Admin key: platform.openai.com → API keys → create with 'Read usage data' scope. Starts with 'sk-admin-'."
                    : selectedProvider?.name === "anthropic"
                    ? "Admin key: console.anthropic.com → API keys. Starts with 'sk-ant-admin-'."
                    : "Your provider's organization admin key for billing/usage access."
                  : selectedProvider?.name === "openai"
                    ? "Personal key: platform.openai.com → API keys. Starts with 'sk-'."
                    : selectedProvider?.name === "anthropic"
                    ? "Personal key: console.anthropic.com → API keys. Starts with 'sk-ant-'."
                    : "Your provider's secret API key. Keep it private — SynthForce encrypts it immediately."
              }
            />
          </label>
          <input
            id="apiKey"
            type="password"
            value={form.apiKey}
            onChange={(e) => set("apiKey", e.target.value)}
            disabled={loading}
            placeholder={
              form.keyType === "admin"
                ? selectedProvider?.name === "openai" ? "sk-admin-…" : selectedProvider?.name === "anthropic" ? "sk-ant-admin-…" : "Paste your admin key"
                : selectedProvider ? `Paste your ${selectedProvider.displayName} key` : "Paste your API key"
            }
            className={inputClass}
            autoComplete="off"
            required
            minLength={10}
            maxLength={500}
          />
          <p className="text-xs text-gray-500 mt-1">
            We encrypt it with AES-256-GCM and never store or log the plaintext.
          </p>
        </div>

        {/* Agent Name */}
        <div>
          <label htmlFor="agentName" className={`${labelClass} flex items-center`}>
            Agent Name <span className="text-red-500 ml-0.5">*</span>
            <FieldHelp text="A human-readable name for this agent within SynthForce — e.g. 'lead-gen-v2' or 'support-bot'. You can rename it later." />
          </label>
          <input
            id="agentName"
            type="text"
            value={form.agentName}
            onChange={(e) => set("agentName", e.target.value)}
            disabled={loading}
            placeholder="e.g., lead-gen-v2"
            className={inputClass}
            required
            minLength={3}
            maxLength={255}
          />
          <p className="text-xs text-gray-500 mt-1">
            This is what SynthForce will call this connection.
          </p>
        </div>

        {/* Department (optional) */}
        <div>
          <label htmlFor="departmentId" className={labelClass}>
            Assign Department <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            id="departmentId"
            value={form.departmentId}
            onChange={(e) => set("departmentId", e.target.value)}
            disabled={loading}
            className={inputClass}
          >
            <option value="">No department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={
            "w-full bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg " +
            "hover:bg-transparent hover:text-[#00B2FF] transition px-5 py-3 text-sm font-medium " +
            (loading ? "opacity-50 cursor-not-allowed" : "")
          }
        >
          {loading ? "Connecting…" : "Connect Agent"}
        </button>
      </form>
    </div>
  );
}

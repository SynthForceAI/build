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

type FieldErrors = Partial<Record<keyof FormState, string>>;

type Banner =
  | { type: "success"; message: string }
  | { type: "error";   message: string }
  | null;

function validateField(
  field: keyof FormState,
  value: string,
  providerName?: string,
  keyType?: "personal" | "admin",
): string | null {
  switch (field) {
    case "providerId":
      return value ? null : "Please select a provider.";
    case "apiKey":
      if (value.length === 0) return null;
      if (value.length < 10) return "API key must be at least 10 characters.";
      if (keyType === "admin") {
        if (providerName === "openai" && !value.startsWith("sk-admin-"))
          return "OpenAI admin keys start with 'sk-admin-'. Check you copied it in full.";
        if (providerName === "anthropic" && !value.startsWith("sk-ant-admin-"))
          return "Anthropic admin keys start with 'sk-ant-admin-'. Check you copied it in full.";
      } else {
        if (providerName === "openai" && !value.startsWith("sk-"))
          return "OpenAI keys start with 'sk-'. Check you copied it in full.";
      }
      return null;
    case "agentName":
      if (value.length === 0) return null;
      if (value.trim().length < 3) return "Agent name must be at least 3 characters.";
      if (value.trim().length > 255) return "Agent name must be under 255 characters.";
      return null;
    default:
      return null;
  }
}

function providerPortalUrl(providerName: string | undefined): string | null {
  if (providerName === "openai")    return "https://platform.openai.com/api-keys";
  if (providerName === "anthropic") return "https://console.anthropic.com/account/keys";
  return null;
}

function actionableApiError(detail: string, providerName: string | undefined): string {
  if (detail.includes("401") || detail.toLowerCase().includes("invalid") || detail.toLowerCase().includes("incorrect")) {
    const portal = providerPortalUrl(providerName);
    return `Invalid API key${portal ? `. Verify it at ${portal}` : ""}. Make sure you copied it fully with no extra spaces.`;
  }
  if (detail.includes("429") || detail.toLowerCase().includes("rate")) {
    return "Rate limit reached. Wait a moment and try again.";
  }
  if (detail.toLowerCase().includes("permission") || detail.toLowerCase().includes("scope")) {
    return "This key doesn't have the required permissions. Check your provider's key settings.";
  }
  if (detail.toLowerCase().includes("already connected")) {
    return "This API key is already connected to your account. Try a different key or manage existing ones in Settings.";
  }
  return detail || "Connection failed. Check your key and try again.";
}

const EMPTY_FORM: FormState = {
  providerId:   "",
  apiKey:       "",
  agentName:    "",
  departmentId: "",
  keyType:      "personal",
};

export function ProviderForm({ providers, departments, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const selectedProvider = providers.find((p) => p.id === form.providerId);

  const fieldErrors: FieldErrors = {};
  for (const field of ["providerId", "apiKey", "agentName"] as const) {
    const err = validateField(field, form[field], selectedProvider?.name, form.keyType);
    if (err) fieldErrors[field] = err;
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setBanner(null);
  }

  function setKeyType(value: "personal" | "admin") {
    setForm((prev) => ({ ...prev, keyType: value, apiKey: "" }));
    setTouched((prev) => ({ ...prev, apiKey: false }));
    setBanner(null);
  }

  function touch(field: keyof FormState) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function showError(field: keyof FormState): string | undefined {
    return touched[field] ? fieldErrors[field] : undefined;
  }

  const isAdminAuditFlow = form.keyType === "admin" && (selectedProvider?.name === "openai" || selectedProvider?.name === "anthropic");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);

    // For admin audit flow, agentName is not required
    const fieldsToValidate: (keyof FormState)[] = isAdminAuditFlow
      ? ["providerId", "apiKey"]
      : ["providerId", "apiKey", "agentName"];

    setTouched(Object.fromEntries(fieldsToValidate.map((f) => [f, true])));

    const hasErrors = fieldsToValidate.some((f) => !!fieldErrors[f]);
    if (hasErrors) return;

    setLoading(true);
    try {
      const body: Record<string, string> = {
        providerId: form.providerId,
        apiKey:     form.apiKey,
        keyType:    form.keyType,
      };
      if (!isAdminAuditFlow && form.agentName.trim()) {
        body.agentName = form.agentName.trim();
      }
      if (!isAdminAuditFlow && form.departmentId) {
        body.departmentId = form.departmentId;
      }

      const res = await fetch("/api/api-keys/connect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data?.error?.detail ?? data?.error?.message ?? "Connection failed. Try again.";
        setBanner({ type: "error", message: actionableApiError(detail, selectedProvider?.name) });
        return;
      }

      // Admin audit flow: redirect to audit results page
      if (data.auditId) {
        window.location.href = `/audit/free?id=${data.auditId}`;
        return;
      }

      setBanner({
        type:    "success",
        message: `Connected! ${data.name} (${selectedProvider?.displayName ?? form.providerId}) is now active.`,
      });
      setForm(EMPTY_FORM);
      setTouched({});
      onSuccess();
    } catch {
      setBanner({ type: "error", message: "Network error. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    "w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 transition-colors";

  function inputClass(field: keyof FormState) {
    const err = showError(field);
    return `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-300"}`;
  }

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">API Integration</h2>
      <p className="text-sm text-gray-600 mb-6">
        Connect a provider API key to bring an agent into SynthForce.
      </p>

      {banner && (
        <div
          role="alert"
          className={
            banner.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm mb-5"
              : "bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm mb-5"
          }
        >
          {banner.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Provider */}
        <div>
          <label htmlFor="providerId" className={`${labelClass} flex items-center`}>
            Provider <span className="text-red-500 ml-0.5">*</span>
            <FieldHelp text="The AI platform that runs your agent, e.g. OpenAI, Anthropic, or Google. SynthForce connects to their API using your key." />
          </label>
          <select
            id="providerId"
            value={form.providerId}
            onChange={(e) => {
              set("providerId", e.target.value);
              touch("providerId");
              setKeyType("personal"); // reset key type when provider changes
            }}
            onBlur={() => touch("providerId")}
            disabled={loading}
            className={inputClass("providerId")}
            aria-invalid={!!showError("providerId")}
            aria-describedby={showError("providerId") ? "providerId-error" : undefined}
            required
          >
            <option value="">Select provider…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
          {showError("providerId") && (
            <p id="providerId-error" className="text-xs text-red-500 mt-1" role="alert">{showError("providerId")}</p>
          )}
        </div>

        {/* Key Type - only OpenAI and Anthropic have org-level usage APIs */}
        {(selectedProvider?.name === "openai" || selectedProvider?.name === "anthropic") && (
          <div>
            <label className={`${labelClass} flex items-center`}>
              Key Type
              <FieldHelp text="Personal keys (sk-…) work for agent activity tracking. Organization Admin keys (sk-admin-… or sk-org-…) also enable automatic billing sync. SynthForce will poll your provider's usage API hourly to keep spend data current." />
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
                    : "Your provider's secret API key. Keep it private. SynthForce encrypts it immediately."
              }
            />
          </label>
          <input
            id="apiKey"
            type="password"
            value={form.apiKey}
            onChange={(e) => set("apiKey", e.target.value)}
            onBlur={() => touch("apiKey")}
            disabled={loading}
            placeholder={
              form.keyType === "admin"
                ? selectedProvider?.name === "openai" ? "sk-admin-…" : selectedProvider?.name === "anthropic" ? "sk-ant-admin-…" : "Paste your admin key"
                : selectedProvider ? `Paste your ${selectedProvider.displayName} key` : "Paste your API key"
            }
            className={inputClass("apiKey")}
            autoComplete="off"
            aria-invalid={!!showError("apiKey")}
            aria-describedby={showError("apiKey") ? "apiKey-error" : "apiKey-hint"}
            required
            minLength={10}
            maxLength={500}
          />
          {showError("apiKey") ? (
            <p id="apiKey-error" className="text-xs text-red-500 mt-1" role="alert">{showError("apiKey")}</p>
          ) : (
            <p id="apiKey-hint" className="text-xs text-gray-500 mt-1">
              Encrypted with AES-256-GCM, never stored or logged as plaintext.
            </p>
          )}
        </div>

        {/* Agent Name - hidden for admin audit flow */}
        {!isAdminAuditFlow && (
          <div>
            <label htmlFor="agentName" className={`${labelClass} flex items-center`}>
              Agent Name <span className="text-red-500 ml-0.5">*</span>
              <FieldHelp text="A human-readable name for this agent within SynthForce, e.g. 'lead-gen-v2' or 'support-bot'. You can rename it later." />
            </label>
            <input
              id="agentName"
              type="text"
              value={form.agentName}
              onChange={(e) => set("agentName", e.target.value)}
              onBlur={() => touch("agentName")}
              disabled={loading}
              placeholder="e.g., lead-gen-v2"
              className={inputClass("agentName")}
              aria-invalid={!!showError("agentName")}
              aria-describedby={showError("agentName") ? "agentName-error" : "agentName-hint"}
              minLength={3}
              maxLength={255}
            />
            {showError("agentName") ? (
              <p id="agentName-error" className="text-xs text-red-500 mt-1" role="alert">{showError("agentName")}</p>
            ) : (
              <p id="agentName-hint" className="text-xs text-gray-500 mt-1">
                This is what SynthForce will call this connection.
              </p>
            )}
          </div>
        )}

        {/* Department - hidden for admin audit flow */}
        {!isAdminAuditFlow && (
          <div>
            <label htmlFor="departmentId" className={labelClass}>
              Assign Department <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              id="departmentId"
              value={form.departmentId}
              onChange={(e) => set("departmentId", e.target.value)}
              disabled={loading}
              className={`${inputBase} border-gray-300`}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {isAdminAuditFlow && (
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            SynthForce will pull your last 30 days of usage and generate a full spend audit with no agent setup needed.
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={
            "w-full flex items-center justify-center gap-2 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg " +
            "hover:bg-transparent hover:text-[#00B2FF] transition px-5 py-3 text-sm font-medium " +
            (loading ? "opacity-60 cursor-not-allowed" : "")
          }
        >
          {loading && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {loading
            ? (isAdminAuditFlow ? "Running audit…" : "Connecting…")
            : (isAdminAuditFlow ? "Run Audit" : "Connect Agent")}
        </button>
      </form>
    </div>
  );
}

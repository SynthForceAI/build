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
): string | null {
  switch (field) {
    case "providerId":
      return value ? null : "Please select a provider.";
    case "apiKey":
      if (value.length === 0) return null;
      if (value.length < 10) return "API key must be at least 10 characters.";
      if (providerName === "openai" && !value.startsWith("sk-admin-"))
        return "OpenAI admin keys start with 'sk-admin-'. Check you copied it in full.";
      if (providerName === "anthropic" && !value.startsWith("sk-ant-admin"))
        return "Anthropic admin keys start with 'sk-ant-admin'. Check you copied it in full.";
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

function providerKeyHint(providerName: string | undefined): { text: string; url?: string; urlLabel?: string } | null {
  if (providerName === "openai") return {
    text: "OAuth integration coming soon. For now, we recommend connecting Anthropic, Google, or AWS.",
  };
  if (providerName === "anthropic") return {
    text: "Need an org admin key? Create one in",
    url: "https://console.anthropic.com/org/keys",
    urlLabel: "console.anthropic.com/org/keys",
  };
  if (providerName === "google" || providerName === "gemini") return {
    text: "Need an API key? Create one in",
    url: "https://aistudio.google.com/apikey",
    urlLabel: "aistudio.google.com/apikey",
  };
  if (providerName === "aws" || providerName === "bedrock") return {
    text: "Need AWS credentials? Create an IAM user with Bedrock access in",
    url: "https://console.aws.amazon.com/",
    urlLabel: "console.aws.amazon.com",
  };
  if (providerName === "azure") return {
    text: "Need an API key? Find it in",
    url: "https://portal.azure.com/",
    urlLabel: "portal.azure.com",
  };
  return null;
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
};

export function ProviderForm({ providers, departments, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const selectedProvider = providers.find((p) => p.id === form.providerId);

  const fieldErrors: FieldErrors = {};
  for (const field of ["providerId", "apiKey", "agentName"] as const) {
    const err = validateField(field, form[field], selectedProvider?.name);
    if (err) fieldErrors[field] = err;
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setBanner(null);
  }

  function touch(field: keyof FormState) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function showError(field: keyof FormState): string | undefined {
    return touched[field] ? fieldErrors[field] : undefined;
  }

  const isAdminAuditFlow = selectedProvider?.name === "openai" || selectedProvider?.name === "anthropic";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);

    const fieldsToValidate: (keyof FormState)[] = isAdminAuditFlow
      ? ["providerId", "apiKey"]
      : ["providerId", "apiKey", "agentName"];

    setTouched(Object.fromEntries(fieldsToValidate.map((f) => [f, true])));

    const hasErrors = fieldsToValidate.some((f) => !!fieldErrors[f]);
    if (hasErrors) return;

    setLoading(true);
    try {
      const body: Record<string, string | number> = {
        providerId:  form.providerId,
        apiKey:      form.apiKey,
        keyType:     "admin",
        periodDays:  30,
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
    <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Connect Your Provider</h2>
      <p className="text-sm text-gray-600 mb-6">
        Paste your org admin key to start monitoring your AI spending across your agent fleet.
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
              set("apiKey", "");
              setTouched((prev) => ({ ...prev, apiKey: false }));
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

        {/* API Key Type - always org admin */}
        {form.providerId && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-blue-900">API Key Type: Organization Admin Key</p>
            <p className="text-xs text-blue-700 mt-0.5">
              We need your org-level key to see billing data. Personal keys can&apos;t access spending info.
            </p>
          </div>
        )}

        {/* API Key */}
        <div>
          <label htmlFor="apiKey" className={`${labelClass} flex items-center`}>
            API Key <span className="text-red-500 ml-0.5">*</span>
            <FieldHelp
              text={
                selectedProvider?.name === "openai"
                  ? "Admin key: platform.openai.com → API keys → create with 'Read usage data' scope. Starts with 'sk-admin-'."
                  : selectedProvider?.name === "anthropic"
                  ? "Admin key: console.anthropic.com/org/keys. Starts with 'sk-ant-admin'."
                  : "Your provider's organization admin key for billing/usage access."
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
              selectedProvider?.name === "openai"
                ? "Paste your org admin key (sk-admin-…)"
                : selectedProvider?.name === "anthropic"
                ? "Paste your org admin key (sk-ant-admin01-…)"
                : "Paste your org admin key here"
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
              Encrypted with AES-256-GCM, never stored in plain text.
            </p>
          )}
          {/* Provider-specific key hint */}
          {(() => {
            const hint = providerKeyHint(selectedProvider?.name);
            if (!hint) return null;
            return (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600">
                {hint.url ? (
                  <span>
                    {hint.text}{" "}
                    <a href={hint.url} target="_blank" rel="noopener noreferrer" className="text-[#00B2FF] hover:underline">
                      {hint.urlLabel}
                    </a>
                  </span>
                ) : (
                  <span>{hint.text}</span>
                )}
              </div>
            );
          })()}
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
            ? (isAdminAuditFlow ? "Running audit…" : "Connecting & syncing history…")
            : (isAdminAuditFlow ? "Run Spending Audit" : "Connect Provider")}
        </button>

        {loading && !isAdminAuditFlow && (
          <p className="text-xs text-center text-gray-500 animate-pulse">
            Pulling up to 30 days of usage history — this takes a few seconds…
          </p>
        )}
      </form>
    </div>
  );
}

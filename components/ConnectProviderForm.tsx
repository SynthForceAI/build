"use client";

import { useEffect, useState } from "react";
import { SecurityBadge } from "@/components/SecurityBadge";

type Provider = { id: string; name: string; displayName: string };

const PORTAL_URLS: Record<string, string> = {
  openai:        "https://platform.openai.com/api-keys",
  anthropic:     "https://console.anthropic.com/account/keys",
  "google-gemini": "https://console.cloud.google.com/apis/credentials",
};

const KEY_HINTS: Record<string, string> = {
  openai:    "sk-admin-…",
  anthropic: "sk-ant-admin-…",
};

interface Props {
  onConnect: (providerId: string, adminKey: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function ConnectProviderForm({ onConnect, isLoading, error }: Props) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [adminKey, setAdminKey] = useState("");

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => {
        const list: Provider[] = data.providers ?? [];
        setProviders(list);
        if (list.length > 0) setProviderId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const selected = providers.find((p) => p.id === providerId);
  const portalUrl = selected ? PORTAL_URLS[selected.name] : null;
  const placeholder = selected ? (KEY_HINTS[selected.name] ?? "Paste your admin API key") : "Paste your admin API key";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adminKey.trim() || !providerId) return;
    onConnect(providerId, adminKey.trim());
  }

  const inputBase =
    "w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B2FF] focus:border-transparent disabled:bg-gray-100 transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Provider selector */}
      <div>
        <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-1">
          Which provider are you using?
        </label>
        <select
          id="provider"
          value={providerId}
          onChange={(e) => { setProviderId(e.target.value); setAdminKey(""); }}
          disabled={isLoading || providers.length === 0}
          className={inputBase}
          required
        >
          {providers.length === 0 && (
            <option value="">Loading providers…</option>
          )}
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.displayName}</option>
          ))}
        </select>
      </div>

      {/* Key input */}
      <div>
        <label htmlFor="adminKey" className="block text-sm font-medium text-gray-700 mb-1">
          Paste your admin API key
        </label>
        <input
          id="adminKey"
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          disabled={isLoading}
          placeholder={placeholder}
          className={inputBase}
          autoComplete="off"
          required
        />
        {portalUrl && (
          <p className="text-xs text-gray-500 mt-1">
            Need a key?{" "}
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00B2FF] hover:underline"
            >
              Create one in {selected?.displayName} →
            </a>
          </p>
        )}
      </div>

      {/* Security badge */}
      <SecurityBadge />

      {/* Error */}
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!adminKey.trim() || !providerId || isLoading}
        className={
          "w-full flex items-center justify-center gap-2 bg-[#00B2FF] text-white border border-[#00B2FF] " +
          "rounded-lg px-5 py-3 text-sm font-medium transition " +
          "hover:bg-transparent hover:text-[#00B2FF] " +
          "disabled:opacity-60 disabled:cursor-not-allowed"
        }
      >
        {isLoading && (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {isLoading ? "Connecting…" : "Connect Provider"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ConnectProviderForm } from "@/components/ConnectProviderForm";

export default function ConnectProviderPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(providerId: string, adminKey: string) {
    setIsLoading(true);
    setError(null);

    try {
      // Store the encrypted admin key
      const storeRes = await fetch(`/api/providers/${providerId}/admin-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey }),
      });

      if (!storeRes.ok) {
        const data = await storeRes.json().catch(() => ({}));
        const detail = data?.error?.detail ?? data?.error?.message ?? "Failed to connect provider";
        setError(detail);
        return;
      }

      toast("Provider connected! Syncing your data…");

      // Fire-and-forget sync - don't block the redirect on it
      fetch(`/api/providers/${providerId}/sync-usage`).catch(() => null);

      router.push("/U/spending");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      {/* Back link */}
      <Link
        href="/U/settings"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition mb-8"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Settings
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Connect Your Provider</h1>
      <p className="text-sm text-gray-500 mb-8">
        Add an admin API key to start seeing your AI spending. Takes 30 seconds.
      </p>

      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <ConnectProviderForm
          onConnect={handleConnect}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}

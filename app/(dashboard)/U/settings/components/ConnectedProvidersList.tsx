"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

type ConnectedProvider = {
  providerId: string;
  providerName: string;
  displayName: string;
  fingerprint: string;
  connectedAt: string;
  lastSyncedAt: string | null;
};

function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

export function ConnectedProvidersList() {
  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  async function loadProviders() {
    const res = await fetch("/api/companies/me/connected-providers");
    if (res.ok) {
      const data = await res.json();
      setProviders(data.connected ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { loadProviders(); }, []);

  async function handleSyncNow(providerId: string, displayName: string) {
    setSyncing(providerId);
    toast(`Syncing ${displayName}…`);
    try {
      const res = await fetch(`/api/providers/${providerId}/sync-usage`);
      if (res.ok) {
        toast.success(`${displayName} synced!`);
        loadProviders();
      } else {
        toast.error(`Sync failed for ${displayName}`);
      }
    } catch {
      toast.error("Network error — check your connection.");
    } finally {
      setSyncing(null);
    }
  }

  async function handleDisconnect(providerId: string, displayName: string) {
    if (!confirm(`Disconnect ${displayName}? This removes your admin key and stops usage syncing.`)) return;
    setDisconnecting(providerId);
    try {
      const res = await fetch(`/api/providers/${providerId}/admin-key`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        toast.success(`${displayName} disconnected.`);
        setProviders((prev) => prev.filter((p) => p.providerId !== providerId));
      } else {
        toast.error(`Failed to disconnect ${displayName}`);
      }
    } catch {
      toast.error("Network error — check your connection.");
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Connected providers section */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Connected Providers</h2>
            <p className="text-xs text-gray-500 mt-0.5">Admin keys used to sync spending data</p>
          </div>
          <Link
            href="/U/onboard"
            className="inline-flex items-center px-4 py-2 text-sm font-medium bg-[#00B2FF] text-white rounded-lg hover:bg-[#00B2FF]/90 transition"
          >
            + Connect
          </Link>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            ))}
          </div>
        ) : providers.length === 0 ? (
          <div className="px-6 py-12 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">No providers connected</p>
            <p className="text-xs text-gray-400 mb-4">
              Connect an admin API key to start syncing spending data.
            </p>
            <Link
              href="/U/onboard"
              className="px-4 py-2 bg-[#00B2FF] text-white text-sm font-medium rounded-lg hover:bg-[#00B2FF]/90 transition"
            >
              Connect your first provider
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {providers.map((p) => (
              <li key={p.providerId} className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[#00B2FF] uppercase">
                        {p.displayName.slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{p.displayName}</p>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">{p.fingerprint}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                        <span>Connected {timeAgo(p.connectedAt)}</span>
                        <span>Last sync: {timeAgo(p.lastSyncedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleSyncNow(p.providerId, p.displayName)}
                      disabled={syncing === p.providerId}
                      className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      {syncing === p.providerId ? "Syncing…" : "Sync now"}
                    </button>
                    <button
                      onClick={() => handleDisconnect(p.providerId, p.displayName)}
                      disabled={disconnecting === p.providerId}
                      className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                    >
                      {disconnecting === p.providerId ? "Removing…" : "Disconnect"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Other settings placeholder */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl px-6 py-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Account</h2>
        <p className="text-sm text-gray-400">
          Team management, billing, and notification preferences — coming soon.
        </p>
      </div>
    </div>
  );
}

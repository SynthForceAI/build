"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RerunButton({ auditId }: { auditId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRerun() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/audits/${auditId}/rerun`, { method: "POST" });
      const data = await res.json() as {
        auditId?: string;
        error?: { code?: string; message?: string; detail?: string };
      };
      if (!res.ok) {
        setError(data.error?.detail ?? data.error?.message ?? "Re-run failed. Try again.");
        setLoading(false);
        return;
      }
      router.push(`/audit/free?id=${data.auditId}`);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleRerun}
        disabled={loading}
        className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running...
          </>
        ) : (
          "↻ Re-run Audit"
        )}
      </button>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

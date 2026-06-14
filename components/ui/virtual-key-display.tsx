"use client";

import { useState } from "react";
import { toast } from "sonner";

interface Props {
  virtualKey: string;
  createdAt:  string;
  lastUsedAt: string | null;
}

export function VirtualKeyDisplay({ virtualKey, createdAt, lastUsedAt }: Props) {
  const [visible, setVisible] = useState(false);

  const masked = virtualKey.slice(0, 10) + "•".repeat(12) + virtualKey.slice(-6);
  const display = visible ? virtualKey : masked;

  function handleCopy() {
    navigator.clipboard.writeText(virtualKey).then(() => {
      toast.success("Virtual key copied to clipboard");
    });
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-blue-900">Virtual API Key</h3>
        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
          Active
        </span>
      </div>

      {/* Key display */}
      <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2.5 font-mono text-sm">
        <span className="flex-1 truncate text-gray-800 select-all">{display}</span>
        <button
          onClick={() => setVisible((v) => !v)}
          className="shrink-0 text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors px-1"
          aria-label={visible ? "Hide key" : "Show key"}
        >
          {visible ? "Hide" : "Show"}
        </button>
        <button
          onClick={handleCopy}
          className="shrink-0 text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors border-l border-blue-100 pl-2"
          aria-label="Copy key to clipboard"
        >
          Copy
        </button>
      </div>

      <p className="text-xs text-blue-700 mt-3 leading-relaxed">
        Set this as your <code className="bg-blue-100 px-1 rounded">OPENAI_API_KEY</code> (or equivalent) in your agent.
        Route requests to <code className="bg-blue-100 px-1 rounded">https://synthforce.ai/api/proxy/{"{provider}"}</code>.
      </p>

      <div className="flex gap-4 mt-3 text-xs text-blue-500">
        <span>Created {new Date(createdAt).toLocaleDateString()}</span>
        {lastUsedAt && (
          <span>Last used {new Date(lastUsedAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}

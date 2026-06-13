"use client";

const FEATURES = [
  "Encrypted with AES-256-GCM",
  "Only used to read spending data (read-only)",
  "Never stored in plain text",
  "Auto-syncs every hour",
  "You can disconnect anytime",
];

export function SecurityBadge() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1">
      <div className="flex items-center gap-2 font-medium text-blue-900 mb-2">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        Your org admin key is safe
      </div>
      <ul className="space-y-1">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-blue-800">
            <span className="text-blue-600 mt-0.5 shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "What data do you actually access?",
    a: "Only aggregated usage and cost totals from your provider's billing API — never prompt content, conversation history, or any data your agents processed.",
  },
  {
    q: "Why should I trust you with my API key?",
    a: "Keys are encrypted at rest before storage. For extra peace of mind, paste a read-only key — it gives us no ability to create, modify, or delete anything, even in a worst-case scenario.",
  },
  {
    q: "How do I create a read-only key?",
    a: "In your provider's API dashboard, create a new key and restrict its permissions to \"read\" or \"usage only.\" It only needs access to billing and usage endpoints — no model access required.",
  },
];

export function OnboardFAQ() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-md border border-gray-200 dark:border-slate-700 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">Common questions</h2>
      <ul className="space-y-4">
        {FAQ_ITEMS.map(({ q, a }) => (
          <li key={q}>
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 mb-1">{q}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{a}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

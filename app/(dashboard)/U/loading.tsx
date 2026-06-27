/**
 * Route-segment loading fallback for /U/* dashboard pages.
 *
 * This renders inside the dashboard layout's <main> area (the sidebar and
 * header stay put), so it must NOT be a full-screen overlay. A subtle,
 * neutral spinner avoids the jarring full-viewport color flash on every
 * navigation.
 */
export default function DashboardLoading() {
  return (
    <div
      className="flex items-center justify-center py-24"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-[#00B2FF] animate-spin" />
    </div>
  );
}

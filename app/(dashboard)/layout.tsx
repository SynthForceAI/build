/**
 * Dashboard layout — the authenticated shell for the SynthForce product.
 *
 * This is a SERVER Component. It runs on every request before any dashboard
 * page renders. Two things happen here:
 *
 *   1. AUTH GATE — requireUser() reads the Supabase auth cookie and looks up
 *      the user row in the database. If no valid session exists, the user is
 *      redirected to "/" (the marketing home). Once a /login page exists,
 *      change that redirect target.
 *
 *   2. SHELL LAYOUT — renders the two-column chrome that wraps every product
 *      page: a left sidebar (DashboardSidebar) and a scrollable main area.
 *
 * WHY Server Component?
 * requireUser() calls the Supabase server client and queries Prisma — both
 * are server-only. A Client Component can't do either. We keep the layout on
 * the server and pass the user data down as props to the DashboardSidebar
 * Client Component, which only needs it for display.
 *
 * File location — app/(dashboard)/layout.tsx:
 * The "(dashboard)" route group doesn't add a URL segment. Pages under this
 * directory are accessed at their normal paths (e.g. /dashboard, /dashboard/agents).
 * The group just lets this layout apply to dashboard pages while the
 * (marketing) layout applies to public pages, keeping the Footer out of the app.
 */

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { DashboardSidebar } from "@/components/ui/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Auth gate ──────────────────────────────────────────────────────────
  // requireUser() throws ApiError(401) in two cases:
  //   - No Supabase session cookie (not logged in at all)
  //   - Session exists but no `users` row in the DB (onboarding incomplete)
  // Both cases should redirect to login. Any other error is unexpected and
  // gets re-thrown so Next.js can show an error boundary.

  // ── TEMP: hardcoded user — restore real auth before merging to nextjs-migration ──
  // To restore: delete the `const user = {...}` block below and uncomment
  // the try/catch block. Also un-comment the imports at the top of the file
  // (redirect, requireUser, ApiError).
  //
  // try {
  //   const { user: _user } = await requireUser();
  //   user = _user;
  // } catch (err) {
  //   if (err instanceof ApiError && err.status === 401) {
  //     redirect("/"); // change to "/login" once that page exists
  //   }
  //   throw err;
  // }
  const user = {
    name: "Dev User",
    email: "dev@test.com",
    role: "owner" as const,
    companyId: "test-company-id",
  };
  // ── END TEMP ──────────────────────────────────────────────────────────

  // ── Shell layout ───────────────────────────────────────────────────────
  return (
    // Full-viewport container. overflow-hidden prevents double scrollbars —
    // only the <main> area below scrolls, not the whole page.
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/*
       * Sidebar — Client Component.
       * We pass user data as plain serialisable props rather than letting the
       * sidebar fetch on its own. requireUser() already paid the DB cost;
       * no reason to pay it twice.
       */}
      <DashboardSidebar
        userName={user.name}
        userEmail={user.email}
        userRole={user.role}
      />

      {/* Right column: thin top bar + scrollable page content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Top bar ─────────────────────────────────────── */}
        {/* Minimal for now — just branding and an escape hatch to the
            marketing site. Will grow to include breadcrumbs / notifications. */}
        <header className="h-16 shrink-0 bg-white border-b border-subtle flex items-center justify-between px-6">
          <span className="text-sm font-semibold text-gray-900">SynthForce</span>
          <a
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Back to site
          </a>
        </header>

        {/* ── Page content ────────────────────────────────── */}
        {/* Each page under app/(dashboard)/ renders here. The overflow-y-auto
            means only this region scrolls, so the sidebar stays fixed in view. */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

      </div>
    </div>
  );
}
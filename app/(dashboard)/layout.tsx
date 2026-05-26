/**
 * Dashboard layout — the authenticated shell for the SynthForce product.
 *
 * This is a SERVER Component. It runs on every request before any LoginDashboard
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
 * File location — app/(LoginDashboard)/layout.tsx:
 * The "(LoginDashboard)" route group doesn't add a URL segment. Pages under this
 * directory are accessed at their normal paths (e.g. /LoginDashboard, /LoginDashboard/agents).
 * The group just lets this layout apply to LoginDashboard pages while the
 * (marketing) layout applies to public pages, keeping the Footer out of the app.
 */

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import type { User } from "@prisma/client";

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

  let user: User;
  try {
    const { user: _user } = await requireUser();
    user = _user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/");
    }
    throw err;
  }

  // ── Shell layout ───────────────────────────────────────────────────────
  // DashboardShell is a Client Component that manages sidebar open/close state
  // and renders the hamburger button. We pass user data as plain props so the
  // server-side requireUser() DB cost is paid exactly once.
  return (
    <DashboardShell
      userName={user.name ?? ""}
      userEmail={user.email}
      userRole={user.role}
    >
      {children}
    </DashboardShell>
  );
}
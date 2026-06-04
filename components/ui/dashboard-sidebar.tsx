"use client";

/**
 * DashboardSidebar — the left navigation rail for all product pages.
 *
 * WHY a Client Component?
 * usePathname() (for active-link highlighting) is a React hook and requires
 * the client. isOpen/onClose state is managed by the parent DashboardShell.
 *
 * Responsive behaviour:
 *  - Mobile (< lg): renders as a fixed overlay drawer. Backdrop click closes it.
 *    Nav link clicks also close it so the content is immediately visible.
 *  - Desktop (lg+): renders as a flex-item sidebar. Toggle collapses it to
 *    zero width with a smooth transition so the content area expands.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

type NavItem = { href: string; label: string; sub: string; roles?: UserRole[] };

// roles omitted = visible to all; otherwise only shown to listed roles.
// owner/admin → full access  |  member → team-level  |  viewer → read-only
const NAV_ITEMS: NavItem[] = [
  { href: "/U",              label: "Dashboard",    sub: "Active agents & overview"   },
  { href: "/U/onboard",      label: "Onboard",      sub: "Add a new AI agent",         roles: ["owner", "admin"] },
  { href: "/U/performance",  label: "Performance",  sub: "Tasks, errors, satisfaction" },
  { href: "/U/compensation", label: "Compensation", sub: "API spend & ROI"             },
  { href: "/U/policies",     label: "Policies",     sub: "Guardrails & compliance",    roles: ["owner", "admin", "member"] },
  { href: "/U/offboarding",  label: "Offboarding",  sub: "Archive & audit",            roles: ["owner", "admin"] },
  { href: "/U/agents",       label: "Agents",       sub: "Manage your fleet",          roles: ["owner", "admin", "member"] },
  { href: "/U/departments",  label: "Departments",  sub: "Teams & budgets",            roles: ["owner", "admin", "member"] },
  { href: "/U/settings",     label: "Settings",     sub: "Account & preferences",      roles: ["owner", "admin"] },
];

type Props = {
  userName:  string;
  userEmail: string;
  userRole:  UserRole;
  isOpen:    boolean;
  onClose:   () => void;
};

export function DashboardSidebar({ userName, userEmail, userRole, isOpen, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out successfully");
      router.push("/login");
    } catch {
      toast.error("Logout failed — please try again");
    }
  }

  return (
    <>
      {/* Backdrop — mobile only, tapping it closes the drawer */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      {/*
       * The aside uses two different hide/show mechanisms depending on breakpoint:
       *
       *  Mobile  (<lg): fixed overlay, slides in/out with translateX
       *  Desktop (lg+): static flex item, expands/collapses via width transition
       *
       * lg:translate-x-0 always overrides the mobile -translate-x-full on desktop.
       * lg:overflow-hidden clips inner content when width reaches 0.
       */}
      <aside
        id="dashboard-sidebar"
        aria-label="Main navigation sidebar"
        className={cn(
          "z-50 bg-white flex flex-col border-r border-gray-200",
          "shadow-[2px_0_12px_rgba(0,0,0,0.04)]",
          // Mobile: fixed full-height overlay
          "fixed inset-y-0 left-0 w-64",
          "transition-transform duration-300 ease-in-out",
          // Desktop: in-flow flex item with width-based collapse
          "lg:static lg:inset-auto",
          "lg:transition-[width] lg:duration-300 lg:overflow-hidden",
          isOpen
            ? "translate-x-0 lg:w-64"
            : "-translate-x-full lg:w-0 lg:translate-x-0"
        )}
      >
        {/*
         * Inner wrapper with a fixed w-64 so text doesn't reflow
         * while the parent width is transitioning from 0 → 256px on desktop.
         */}
        <div className="w-64 flex flex-col h-full overflow-hidden">

          {/* ── Logo ─────────────────────────────────────────── */}
          <div className="h-16 shrink-0 flex items-center justify-center px-5 border-b border-gray-100">
            <Link href="/U" aria-label="Go to dashboard home">
              <img
                src="/assets/logo_hero.png"
                alt="SynthForce"
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>

          {/* ── Nav links ─────────────────────────────────────── */}
          <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto" aria-label="Main navigation">
            {NAV_ITEMS.filter(({ roles }) => !roles || roles.includes(userRole)).map(({ href, label, sub }) => {
              const isActive =
                href === "/U"
                  ? pathname === "/U"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      onClose();
                    }
                  }}
                  className={cn(
                    "group flex flex-col px-3 py-2.5 rounded-xl transition-all duration-200 border-l-[3px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B2FF] focus-visible:ring-offset-1",
                    isActive
                      ? "border-l-[#00B2FF] bg-blue-50 shadow-sm"
                      : "border-l-transparent hover:bg-gray-50 hover:border-l-gray-200"
                  )}
                >
                  <span className={cn(
                    "font-semibold text-[13px] transition-colors duration-200",
                    isActive
                      ? "text-[#00B2FF]"
                      : "text-gray-700 group-hover:text-gray-900"
                  )}>
                    {label}
                  </span>
                  <span className={cn(
                    "text-xs mt-0.5 transition-colors duration-200",
                    isActive
                      ? "text-[#00B2FF]/60"
                      : "text-gray-400 group-hover:text-gray-500"
                  )}>
                    {sub}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* ── User info + logout ────────────────────────────── */}
          <div className="p-2 border-t border-gray-100 shrink-0 space-y-1.5">
            <Link
              href="/U/profile"
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                  onClose();
                }
              }}
              className="group block p-3 rounded-lg border border-gray-200 bg-white hover:border-[#00B2FF] hover:shadow-sm transition-all"
              aria-label="View profile"
            >
              <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{userEmail}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                  {userRole}
                </span>
                <span className="text-xs font-medium text-[#00B2FF] flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                  View Profile
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              aria-label="Sign out"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>

        </div>
      </aside>
    </>
  );
}

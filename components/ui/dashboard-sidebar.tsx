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
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

const NAV_ITEMS = [
  { href: "/dashboard",             label: "Dashboard"   },
  { href: "/dashboard/agents",      label: "Agents"      },
  { href: "/dashboard/performance", label: "Performance" },
  { href: "/dashboard/departments", label: "Departments" },
  { href: "/dashboard/policies",    label: "Policies"    },
  { href: "/dashboard/settings",    label: "Settings"    },
] as const;

type Props = {
  userName:  string;
  userEmail: string;
  userRole:  UserRole;
  isOpen:    boolean;
  onClose:   () => void;
};

export function DashboardSidebar({ userName, userEmail, userRole, isOpen, onClose }: Props) {
  const pathname = usePathname();

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
        className={cn(
          "z-50 bg-void text-white flex flex-col",
          // Mobile: fixed full-height overlay
          "fixed inset-y-0 left-0 w-56",
          "transition-transform duration-300 ease-in-out",
          // Desktop: in-flow flex item with width-based collapse
          "lg:static lg:inset-auto",
          "lg:transition-[width] lg:duration-300 lg:overflow-hidden",
          isOpen
            ? "translate-x-0 lg:w-56"
            : "-translate-x-full lg:w-0 lg:translate-x-0"
        )}
      >
        {/*
         * Inner wrapper with a fixed w-56 so text and icons don't reflow
         * while the parent width is transitioning from 0 → 224px on desktop.
         */}
        <div className="w-56 flex flex-col h-full overflow-hidden">

          {/* ── Logo ─────────────────────────────────────────── */}
          <div className="h-16 shrink-0 flex items-center px-5 border-b border-white/10">
            <Link href="/dashboard" aria-label="Go to dashboard home">
              <img
                src="/assets/logo_white_with_name.png"
                alt="SynthForce"
                className="h-8 w-auto object-contain"
              />
            </Link>
          </div>

          {/* ── Nav links ─────────────────────────────────────── */}
          <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5" aria-label="Main navigation">
            {NAV_ITEMS.map(({ href, label }) => {
              const isActive =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  // Close the drawer on mobile after navigating
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      onClose();
                    }
                  }}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* ── User info ─────────────────────────────────────── */}
          <div className="px-4 py-4 border-t border-white/10 shrink-0">
            <p className="text-sm text-white truncate">{userName}</p>
            <p className="text-xs text-white/50 truncate mt-0.5">{userEmail}</p>
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 capitalize">
              {userRole}
            </span>
          </div>

        </div>
      </aside>
    </>
  );
}

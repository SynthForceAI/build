"use client";

/**
 * DashboardSidebar — the left navigation rail for all product pages.
 *
 * WHY a Client Component?
 * We use usePathname() (a React hook) to highlight the active link.
 * Hooks can only run on the client. Everything else here is static, but
 * the whole component must be "use client" for hooks to work.
 *
 * WHY is user data passed as props instead of fetched here?
 * The parent layout (app/(dashboard)/layout.tsx) already has the user row
 * from requireUser(). Passing it down as props means we do exactly one DB
 * lookup per request instead of two.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";

// Each entry maps to a route that exists (or will exist) under app/(dashboard)/
const NAV_ITEMS = [
  { href: "/dashboard",             label: "Dashboard"   },
  { href: "/dashboard/agents",      label: "Agents"      },
  { href: "/dashboard/departments", label: "Departments" },
  { href: "/dashboard/policies",    label: "Policies"    },
  { href: "/dashboard/settings",    label: "Settings"    },
] as const;

type Props = {
  userName:  string;
  userEmail: string;
  userRole:  UserRole;
};

export function DashboardSidebar({ userName, userEmail, userRole }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-void text-white flex flex-col">

      {/* ── Logo ─────────────────────────────────────────── */}
      {/* Links to /dashboard so clicking the logo always goes "home" */}
      <div className="h-16 flex items-center px-5 border-b border-white/10">
        <Link href="/dashboard" aria-label="Go to dashboard home">
          {/* Using <img> (not next/image) to match the pattern in site-nav and footer */}
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
          /**
           * Active-link logic:
           * - "/dashboard" only matches exactly, so it isn't highlighted
           *   when you're at "/dashboard/agents".
           * - All other links match any sub-path (e.g. /dashboard/agents/123
           *   keeps "Agents" highlighted).
           */
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── User info ─────────────────────────────────────── */}
      {/* Shows who is logged in and their role. Role drives what API
          routes allow — owner/admin can create and delete, member can read. */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-sm text-white truncate">{userName}</p>
        <p className="text-xs text-white/50 truncate mt-0.5">{userEmail}</p>
        <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 capitalize">
          {userRole}
        </span>
      </div>

    </aside>
  );
}

"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardSidebar } from "./dashboard-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@prisma/client";

const PAGE_LABELS: Record<string, string> = {
  "/U":              "Dashboard",
  "/U/spending":     "AI Spending",
  "/U/onboard":      "Onboard",
  "/U/performance":  "Performance",
  "/U/compensation": "Compensation",
  "/U/policies":     "Policies",
  "/U/offboarding":  "Offboarding",
  "/U/agents":       "Agents",
  "/U/departments":  "Departments",
  "/U/settings":         "Settings",
  "/U/settings/connect": "Connect Provider",
  "/U/profile":          "Profile",
};

function usePageLabel(): string {
  const pathname = usePathname();
  // Exact match first, then longest prefix
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  const match = Object.keys(PAGE_LABELS)
    .filter((k) => k !== "/U" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_LABELS[match] : "SynthForce";
}

type Props = {
  userName:  string;
  userEmail: string;
  userRole:  UserRole;
  children:  React.ReactNode;
};

export function DashboardShell({ userName, userEmail, userRole, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pageLabel = usePageLabel();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const initials = userName
    ? userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Skip-to-content link - visible on focus for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#00B2FF] focus:text-white focus:text-sm focus:font-medium focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>
      <DashboardSidebar
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        <header role="banner" className="h-16 shrink-0 bg-white border-b border-subtle flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B2FF] transition-colors"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
              aria-expanded={sidebarOpen}
              aria-controls="dashboard-sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                <rect y="2"  width="18" height="2" rx="1" />
                <rect y="8"  width="18" height="2" rx="1" />
                <rect y="14" width="18" height="2" rx="1" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900" aria-live="polite">{pageLabel}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center hover:bg-gray-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#00B2FF]">
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/U/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/U/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6" tabIndex={-1}>
          <div className="animate-fade-in">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}

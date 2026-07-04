"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { ThemeToggle } from "@/components/ui/theme-toggle";

type Props = {
  userName:        string;
  userEmail:       string;
  userRole:        UserRole;
  isPlatformOwner: boolean;
  children:        React.ReactNode;
};

export function DashboardShell({ userName, userEmail, userRole, isPlatformOwner, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const initials = userName
    ? userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-950">
      {/* Skip-to-content link - visible on focus for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#00B2FF] focus:text-white focus:text-sm focus:font-medium focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>
      <DashboardSidebar
        userRole={userRole}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        <header role="banner" className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-subtle dark:border-slate-700/60 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B2FF] transition-colors"
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
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center hover:bg-gray-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#00B2FF]">
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2.5">
                <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/U/profile">View Profile</Link>
              </DropdownMenuItem>
              {isPlatformOwner && (
                <DropdownMenuItem asChild>
                  <Link href="/owner/users" className="text-[#00B2FF] focus:text-[#00B2FF]">
                    Owner Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
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

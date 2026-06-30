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
    <div className="flex h-screen overflow-hidden bg-gray-50">
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
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center hover:bg-gray-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#00B2FF]">
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <Link
                href="/U/profile"
                className="group block px-3 py-3 rounded-md border border-gray-200 bg-white hover:border-[#00B2FF] hover:shadow-sm transition-all mx-1 my-1"
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
              <DropdownMenuSeparator />
              {isPlatformOwner && (
                <DropdownMenuItem asChild>
                  <Link href="/owner/users" className="text-[#00B2FF] focus:text-[#00B2FF]">
                    <svg className="w-3.5 h-3.5 shrink-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
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

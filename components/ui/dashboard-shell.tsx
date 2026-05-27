"use client";

import { useState } from "react";
import { DashboardSidebar } from "./dashboard-sidebar";
import type { UserRole } from "@prisma/client";

type Props = {
  userName:  string;
  userEmail: string;
  userRole:  UserRole;
  children:  React.ReactNode;
};

export function DashboardShell({ userName, userEmail, userRole, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <DashboardSidebar
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        <header className="h-16 shrink-0 bg-white border-b border-subtle flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger — collapses sidebar on desktop, opens drawer on mobile */}
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect y="2"  width="18" height="2" rx="1" />
                <rect y="8"  width="18" height="2" rx="1" />
                <rect y="14" width="18" height="2" rx="1" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">SynthForce</span>
          </div>
          <a
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Back to site
          </a>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>

      </div>
    </div>
  );
}

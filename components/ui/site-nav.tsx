"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OriginalNavbar } from "@/components/ui/navbars";
import { WaitlistTrigger } from "@/components/ui/waitlist-trigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavUser = { name: string; email: string };

type SiteNavProps = {
  position?: "sticky" | "fixed";
  user?: NavUser | null;
};

export function SiteNav({ position = "sticky", user = null }: SiteNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const close = () => setMobileMenuOpen(false);
  const positionClass = position === "fixed" ? "fixed" : "sticky";

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <nav className={`${positionClass} top-0 w-full z-50 border-b border-subtle bg-white/80 backdrop-blur-md`}>
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <img src="/assets/logo_top_corner.png" className="h-8 max-h-8 w-auto object-contain" alt="SynthForce Logo" />
          </Link>
        </div>

        <div className="flex items-center gap-6">
          <OriginalNavbar />

          {/* Desktop auth area */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center hover:bg-gray-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/U">Dashboard</Link>
                  </DropdownMenuItem>
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
            ) : (
              <>
                <Link href="/login" className="text-sm font-semibold text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg px-4 py-1.5 hover:border-gray-500 transition">
                  Login
                </Link>
                <Link href="/signup" className="text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-1.5 transition">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            aria-controls="site-nav-mobile-menu"
            aria-label="Toggle menu"
            className="md:hidden text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="site-nav-mobile-menu" className="md:hidden bg-white border-t border-subtle px-6 py-4">
          <div className="flex flex-col gap-4 text-sm font-sans text-gray-600">
            <Link href="/product" onClick={close} className="py-2 hover:text-gray-900">Product</Link>
            <Link href="/demo" onClick={close} className="py-2 hover:text-gray-900">Demo</Link>
            <Link href="/blog" onClick={close} className="py-2 hover:text-gray-900">Blog</Link>
            <Link href="/faq" onClick={close} className="py-2 hover:text-gray-900">FAQ</Link>
            <Link href="/hard-truth" onClick={close} className="py-2 font-semibold text-red-600 hover:text-red-700">The Hard Truth</Link>
            <WaitlistTrigger onClick={close} className="py-2 text-gray-900 font-medium cursor-pointer">
              Waitlist →
            </WaitlistTrigger>

            <div className="flex flex-col gap-2 pt-2 border-t border-subtle">
              {user ? (
                <>
                  <Link href="/U" onClick={close} className="py-2 font-semibold text-gray-900 hover:text-gray-700">Dashboard</Link>
                  <Link href="/U/profile" onClick={close} className="py-2 hover:text-gray-900">Profile</Link>

                  <Link href="/U/settings" onClick={close} className="py-2 hover:text-gray-900">Settings</Link>
                  <button onClick={handleSignOut} className="text-left py-2 text-red-600 font-medium hover:text-red-700">
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/login" onClick={close} className="flex-1 text-center text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg px-4 py-2">Login</Link>
                  <Link href="/signup" onClick={close} className="flex-1 text-center text-sm font-semibold text-white bg-gray-900 rounded-lg px-4 py-2">Sign Up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

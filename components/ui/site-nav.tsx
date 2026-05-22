"use client";

import Link from "next/link";
import { useState } from "react";
import { OriginalNavbar } from "@/components/ui/navbars";
import { WaitlistTrigger } from "@/components/ui/waitlist-trigger";

type SiteNavProps = {
  position?: "sticky" | "fixed";
};

export function SiteNav({ position = "sticky" }: SiteNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const close = () => setMobileMenuOpen(false);
  const positionClass = position === "fixed" ? "fixed" : "sticky";

  return (
    <nav
      className={`${positionClass} top-0 w-full z-50 border-b border-subtle bg-white/80 backdrop-blur-md`}
    >
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <img
              src="/assets/logo_top_corner.png"
              className="h-8 max-h-8 w-auto object-contain"
              alt="SynthForce Logo"
            />
          </Link>
        </div>
        <OriginalNavbar />
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-expanded={mobileMenuOpen}
          aria-controls="site-nav-mobile-menu"
          aria-label="Toggle menu"
          className="md:hidden text-gray-700"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
      {mobileMenuOpen && (
        <div
          id="site-nav-mobile-menu"
          className="md:hidden bg-white border-t border-subtle px-6 py-4"
        >
          <div className="flex flex-col gap-4 text-sm font-sans text-gray-600">
            <Link href="/" onClick={close} className="py-2 hover:text-gray-900">Home</Link>
            <Link href="/product" onClick={close} className="py-2 hover:text-gray-900">Product</Link>
            <Link href="/demo" onClick={close} className="py-2 hover:text-gray-900">Demo</Link>
            <Link href="/blog" onClick={close} className="py-2 hover:text-gray-900">Blog</Link>
            <Link href="/about" onClick={close} className="py-2 hover:text-gray-900">About</Link>
            <WaitlistTrigger
              onClick={close}
              className="py-2 text-gray-900 font-medium cursor-pointer"
            >
              Waitlist →
            </WaitlistTrigger>
          </div>
        </div>
      )}
    </nav>
  );
}

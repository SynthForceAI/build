"use client";

import { useState } from "react";
import Link from "next/link";

export default function AboutPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 w-full z-50 border-b border-subtle bg-white/80 backdrop-blur-md">
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
          <div className="hidden md:flex gap-8 text-sm font-sans text-gray-600">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <Link href="/product" className="hover:text-gray-900">Product</Link>
            <Link href="/demo" className="hover:text-gray-900">Demo</Link>
            <Link href="/blog" className="hover:text-gray-900">Blog</Link>
            <Link href="/about" className="hover:text-gray-900">About</Link>
            <Link
              href="/waitlistsignup"
              className="text-gray-900 hover:underline decoration-1 underline-offset-4"
            >
              Waitlist →
            </Link>
          </div>
          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="md:hidden text-gray-700"
            aria-label="Toggle menu"
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
          <div className="md:hidden bg-white border-t border-subtle px-6 py-4">
            <div className="flex flex-col gap-4 text-sm font-sans text-gray-600">
              <Link href="/" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Home</Link>
              <Link href="/product" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Product</Link>
              <Link href="/demo" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Demo</Link>
              <Link href="/blog" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
              <Link href="/about" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>About</Link>
              <Link
                href="/waitlistsignup"
                className="py-2 text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Waitlist →
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-12 pb-20 container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">About SynthForce</h1>
          <p className="text-xl text-gray-600 mb-10">Our team page is coming soon.</p>
          <p className="text-gray-600">
            We&rsquo;re currently focused on building the product. Check back later for founder
            story, mission details, and team bios.
          </p>
          <p className="mt-8">
            <Link href="/product" className="text-accent hover:underline">
              View our product →
            </Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-subtle py-12 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/logo_top_corner.png"
                  className="h-8 max-h-8 w-auto object-contain"
                  alt="SynthForce Logo"
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                HR for AI agents. Manage your synthetic workforce.
              </p>
            </div>
            <div className="flex flex-wrap gap-8 text-sm text-gray-600">
              <Link href="/" className="hover:text-gray-900">Home</Link>
              <Link href="/product" className="hover:text-gray-900">Product</Link>
              <Link href="/demo" className="hover:text-gray-900">Demo</Link>
              <Link href="/about" className="hover:text-gray-900">About</Link>
              <Link href="/blog" className="hover:text-gray-900">Blog</Link>
              <Link href="/waitlistsignup" className="hover:text-gray-900">Waitlist</Link>
              <a href="#" className="hover:text-gray-900">Privacy</a>
              <a href="#" className="hover:text-gray-900">Terms</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-subtle text-center text-sm text-gray-500">
            <p>© 2026 SynthForce AI. All rights reserved. | Built at Cornell University.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
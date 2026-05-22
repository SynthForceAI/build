import Link from "next/link";
import { WaitlistTrigger } from "@/components/ui/waitlist-trigger";

interface SiteNavProps {
  position?: "fixed" | "sticky" | "relative";
}

export function SiteNav({ position = "sticky" }: SiteNavProps) {
  const positionClass =
    position === "fixed"
      ? "fixed top-0 left-0 right-0"
      : position === "sticky"
      ? "sticky top-0"
      : "relative";

  return (
    <nav
      className={`${positionClass} w-full z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md`}
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
          <span className="font-bold tracking-tighter text-lg text-gray-900 hidden sm:inline">
            SynthForce
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-sans text-gray-600">
          <Link href="/" className="hover:text-gray-900">
            Home
          </Link>
          <Link href="/product" className="hover:text-gray-900">
            Product
          </Link>
          <Link href="/demo" className="hover:text-gray-900">
            Demo
          </Link>
          <Link href="/blog" className="hover:text-gray-900">
            Blog
          </Link>
          <Link href="/about" className="hover:text-gray-900">
            About
          </Link>
          <WaitlistTrigger className="text-gray-900 hover:underline decoration-1 underline-offset-4 cursor-pointer">
            Waitlist →
          </WaitlistTrigger>
          <Link
            href="/login"
            className="text-sm font-semibold text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg px-4 py-1.5 hover:border-gray-500 transition"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-1.5 transition"
          >
            Sign Up
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold text-white bg-gray-900 rounded-lg px-3 py-1.5"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}

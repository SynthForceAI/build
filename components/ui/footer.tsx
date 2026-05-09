import Link from "next/link";
import { Year }from "@/lib/utils"
import { WaitlistTrigger } from "@/components/ui/waitlist-trigger";

export function Footer() {
  return (
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
            <WaitlistTrigger className="hover:text-gray-900 cursor-pointer">Waitlist</WaitlistTrigger>
            <a href="mailto:info@synthforceai.com" className="hover:text-gray-900">Contact</a>
            <a href="#" className="hover:text-gray-900">Privacy</a>
            <a href="#" className="hover:text-gray-900">Terms</a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-subtle text-center text-sm text-gray-500">
          <p>© { Year } SynthForce AI. All rights reserved. | Built at Cornell University.</p>
        </div>
      </div>
    </footer>
  );
}
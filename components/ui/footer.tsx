import Link from "next/link";
import { Year }from "@/lib/utils"
import { WaitlistTrigger } from "@/components/ui/waitlist-trigger";

export function Footer() {
  return (
    <footer className="border-t border-subtle dark:border-gray-700 py-12 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-6 md:mb-0">
            <div className="flex items-center gap-3">
              <img
                src="/assets/7.png"
                className="h-8 max-h-8 w-auto object-contain dark:hidden"
                alt="SynthForce Logo"
              />
              <img
                src="/assets/logo_full_white.svg"
                className="h-8 max-h-8 w-auto object-contain hidden dark:block"
                alt="SynthForce Logo"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              HR for AI agents. Manage your synthetic workforce.
            </p>
          </div>
          <div className="flex flex-wrap gap-8 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/" className="hover:text-gray-900 dark:hover:text-white">Home</Link>
            <Link href="/product" className="hover:text-gray-900 dark:hover:text-white">Product</Link>
            <Link href="/demo" className="hover:text-gray-900 dark:hover:text-white">Demo</Link>
            <Link href="/about" className="hover:text-gray-900 dark:hover:text-white">About</Link>
            <Link href="/blog" className="hover:text-gray-900 dark:hover:text-white">Blog</Link>
            <WaitlistTrigger className="hover:text-gray-900 dark:hover:text-white cursor-pointer">Waitlist</WaitlistTrigger>
            <a href="mailto:info@synthforceai.com" className="hover:text-gray-900 dark:hover:text-white">Contact</a>
            <a href="#" className="hover:text-gray-900 dark:hover:text-white">Privacy</a>
            <a href="#" className="hover:text-gray-900 dark:hover:text-white">Terms</a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-subtle dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-500">
          <p>© { Year } SynthForce AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
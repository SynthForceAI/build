import Link from "next/link";
import { WaitlistTrigger } from "@/components/ui/waitlist-trigger";

export function OriginalNavbar() {
    return (
        <div className="hidden md:flex gap-8 text-sm font-sans text-gray-600">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <Link href="/product" className="hover:text-gray-900">Product</Link>
            <Link href="/demo" className="hover:text-gray-900">Demo</Link>
            <Link href="/blog" className="hover:text-gray-900">Blog</Link>
            <Link href="/about" className="hover:text-gray-900">About</Link>
            <WaitlistTrigger className="text-gray-900 hover:underline decoration-1 underline-offset-4 cursor-pointer">
                Waitlist →
            </WaitlistTrigger>
        </div>
    )
}

export function DemoPageNavbar() {
    return (
        <nav className="sticky top-0 w-full z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <a href="/">
                        <img src="/assets/logo_top_corner.png" className="h-8 max-h-8 w-auto object-contain"
                             alt="SynthForce Logo"/>
                    </a>
                    <span
                        className="font-bold tracking-tighter text-lg text-gray-900 hidden sm:inline">SynthForce Demo</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full hidden sm:inline">HR SaaS for AI Agents</span>
                </div>
                <div className="hidden md:flex gap-8 text-sm font-sans text-gray-600">
                    <a href="/" className="hover:text-gray-900">Home</a>
                    <a href="/product" className="hover:text-gray-900">Product</a>
                    <a href="/demo" className="hover:text-gray-900">Demo</a>
                    <a href="/blog" className="hover:text-gray-900">Blog</a>
                    <a href="/about" className="hover:text-gray-900">About</a>
                    <WaitlistTrigger className="text-gray-900 hover:underline decoration-1 underline-offset-4 cursor-pointer">Waitlist
                        →</WaitlistTrigger>
                </div>
                <button id="mobile-menu-toggle" className="md:hidden text-gray-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                         xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </button>
            </div>
            <div id="mobile-menu" className="md:hidden hidden bg-white border-t border-gray-200 px-6 py-4">
                <div className="flex flex-col gap-4 text-sm font-sans text-gray-600">
                    <a href="/" className="py-2 hover:text-gray-900">Home</a>
                    <a href="/product" className="py-2 hover:text-gray-900">Product</a>
                    <a href="/demo" className="py-2 hover:text-gray-900">Demo</a>
                    <a href="/blog" className="py-2 hover:text-gray-900">Blog</a>
                    <a href="/about" className="py-2 hover:text-gray-900">About</a>
                    <WaitlistTrigger className="py-2 text-gray-900 font-medium cursor-pointer">Waitlist →</WaitlistTrigger>
                </div>
            </div>
        </nav>
    )
}

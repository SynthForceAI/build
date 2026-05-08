import Link from "next/link";

export function OriginalNavbar() {
    return (
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
    )
}

export function DifferentialNavbar() {
    return (
        // Can create new custom navbar in the future
        <div>

        </div>
    )
}

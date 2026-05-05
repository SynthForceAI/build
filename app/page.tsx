import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-paper p-8 font-sans text-void">
      <h1 className="text-4xl font-bold tracking-tight">
        SynthForce — Tailwind is up.
      </h1>
      <p className="mt-4 text-gray-600">
        Theme check: the heading should be black (Inter font), the button cyan,
        and the card outlined in light gray.
      </p>
      <button className="mt-6 rounded-lg bg-accent px-6 py-3 font-semibold text-paper transition hover:bg-void">
        Accent button (#00B2FF)
      </button>
      <div className="mt-6 max-w-sm rounded-lg border border-subtle p-4">
        Card with subtle border.
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
    </main>
  );
}

// TODO: index.html is migrated with app/page.tsx. need to remove index and migrate information over UI
// TODO: migrate rest of the pages to app/about, app/xxx
// TODO: MAYBE add some UI frameworks: kokonut UI, shadcn UI are my go to.
// TODO: demo.html is the hardest to migrate. spend some time reading over the code to see what to replace/shorten/add, etc.
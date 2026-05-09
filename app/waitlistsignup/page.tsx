import type { Metadata } from "next";
import Link from "next/link";
import { OriginalNavbar } from "@/components/ui/navbars";

export const metadata: Metadata = {
  title: "SynthForce | Join the Waitlist",
  description:
    "Join the SynthForce waitlist for early access, a free agent-audit report, and 6 months free for your first 5 AI agents.",
};

export default function WaitlistSignupPage() {
  return (
    <>
      <nav className="sticky top-0 w-full z-50 border-b border-subtle bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/assets/logo_top_corner.png"
              className="h-8 max-h-8 w-auto object-contain"
              alt="SynthForce Logo"
            />
          </Link>
          <OriginalNavbar />
        </div>
      </nav>

      <main className="pt-12 pb-20 container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Join the Waitlist
          </h1>
          <p className="text-xl text-gray-600 mb-10">
            Be the first to get early access, a free agent-audit report, and manage your first 5
            agents free for 6 months.
          </p>
          <p className="text-sm text-gray-500">Fill out the form below. No spam. Unsubscribe anytime.</p>
        </div>

        <div className="max-w-3xl mx-auto border border-subtle rounded-2xl overflow-hidden shadow-lg">
          <iframe
            src="https://tally.so/embed/D4DGyq?transparentBackground=1"
            width="100%"
            height={800}
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
            title="SynthForce Waiting List"
          />
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-block px-8 py-4 font-sans font-semibold text-sm uppercase rounded-lg bg-[#00B2FF] text-white border border-[#00B2FF] hover:bg-transparent hover:text-[#00B2FF] transition"
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    </>
  );
}

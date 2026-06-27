import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  searchParams: Promise<{ email?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#00B2FF] px-6">
      <div className="flex flex-col items-center gap-8 max-w-md w-full text-center">
        {/* Logo */}
        <img
          src="https://www.synthforceai.com/assets/7.png"
          alt="SynthForce"
          className="w-[576px] h-auto"
        />

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-10 w-full">
          <h1 className="text-4xl font-bold text-black mb-3">Check your email</h1>
          <p className="text-black text-lg leading-relaxed">
            We sent a verification link to{" "}
            {email ? (
              <span className="font-semibold text-black">{email}</span>
            ) : (
              "your email address"
            )}
            . Click the link in the email to verify your account.
          </p>

          <div className="mt-8">
            <Button
              asChild
              className="w-full bg-white text-[#00B2FF] hover:bg-white/90 font-semibold"
            >
              <Link href="/login">Go to Login</Link>
            </Button>
          </div>
        </div>

        <p className="text-black/70 text-sm">
          Didn&apos;t receive an email? Check your spam folder or{" "}
          <Link href="/signup" className="text-black underline underline-offset-2">
            try signing up again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

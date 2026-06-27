import { VerifyEmailCard } from "@/components/auth/VerifyEmailCard";

type VerifyEmailPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
  }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#EDEDED] mb-1">SynthForce</h1>
          <p className="text-[#A1A1AA] text-sm">HR for AI Agents</p>
        </div>
        <VerifyEmailCard email={params.email} errorCode={params.error} />
      </div>
    </div>
  );
}

import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#EDEDED] mb-2">SynthForce</h1>
          <p className="text-[#A1A1AA]">HR for AI Agents</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}

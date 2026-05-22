import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left side — branding + value props */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 bg-[#0D0D0D] border-r border-[#1a1a1a]">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-8 h-8 rounded-lg bg-white" />
            <span className="text-xl font-bold text-[#EDEDED]">SynthForce</span>
          </div>
          <h2 className="text-3xl font-bold text-[#EDEDED] leading-tight mb-4">
            Your workforce is getting smarter.
            <br />
            <span className="text-[#6366F1]">Your management should too.</span>
          </h2>
          <ul className="space-y-4 mt-10">
            <li className="flex items-start gap-3 text-[#A1A1AA]">
              <span className="text-[#6366F1] mt-1">▸</span>
              <span>Track every AI agent's performance and cost in real time</span>
            </li>
            <li className="flex items-start gap-3 text-[#A1A1AA]">
              <span className="text-[#6366F1] mt-1">▸</span>
              <span>Set budgets and policies that agents follow automatically</span>
            </li>
            <li className="flex items-start gap-3 text-[#A1A1AA]">
              <span className="text-[#6366F1] mt-1">▸</span>
              <span>Get plain-English reports on exactly where your spend is going</span>
            </li>
            <li className="flex items-start gap-3 text-[#A1A1AA]">
              <span className="text-[#6366F1] mt-1">▸</span>
              <span>Free audit shows you how much you're wasting — before you commit</span>
            </li>
          </ul>
        </div>
        <div className="text-[#52525B] text-sm">
          &copy; 2026 SynthForce AI Inc.
        </div>
      </div>

      {/* Right side — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-[#EDEDED] mb-1">SynthForce</h1>
            <p className="text-[#A1A1AA] text-sm">HR for AI Agents</p>
          </div>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}

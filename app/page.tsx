export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-12">
        {/* Hero Section */}
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
            Intelligent Policy Enforcement
          </h1>
          <p className="text-xl text-gray-400">
            Automate policy enforcement across your organization with intelligent request handling and compliance tracking.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-3">
            <div className="text-2xl">🔐</div>
            <h3 className="text-lg font-semibold text-white">Secure by Default</h3>
            <p className="text-sm text-gray-400">Enterprise-grade security with HTTP-only cookies and encrypted sessions.</p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-3">
            <div className="text-2xl">📊</div>
            <h3 className="text-lg font-semibold text-white">Complete Visibility</h3>
            <p className="text-sm text-gray-400">Track all user activity and policy enforcement actions in real-time.</p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-3">
            <div className="text-2xl">⚡</div>
            <h3 className="text-lg font-semibold text-white">Lightning Fast</h3>
            <p className="text-sm text-gray-400">Instant policy checks and enforcement across your entire organization.</p>
          </div>
        </div>

        {/* CTA Text */}
        <div className="pt-6 border-t border-gray-800">
          <p className="text-gray-400">
            Use the <span className="text-blue-400 font-semibold">"Sign up or in"</span> button above to get started
          </p>
        </div>
      </div>
    </div>
  );
}

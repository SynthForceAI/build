"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SectionId = "dashboard" | "onboard" | "performance" | "compensation" | "policy" | "offboarding";

const SECTIONS: { id: SectionId; title: string; subtitle: string }[] = [
  { id: "dashboard", title: "Dashboard", subtitle: "Active agents & overview" },
  { id: "onboard", title: "Onboard", subtitle: "Add a new AI agent" },
  { id: "performance", title: "Performance", subtitle: "Tasks, errors, satisfaction" },
  { id: "compensation", title: "Compensation", subtitle: "API spend & budgets" },
  { id: "policy", title: "Policy", subtitle: "Guardrails & compliance" },
  { id: "offboarding", title: "Offboarding", subtitle: "Archive & audit" },
];

export default function DashboardPage() {
  const [active, setActive] = useState<SectionId>("dashboard");
  const [hasAgents, setHasAgents] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setHasAgents(true);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <img src="/assets/synthforce-logo.png" className="h-8 w-auto object-contain" alt="SynthForce" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-4 py-1.5">
            Log Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className={`${mobileMenuOpen ? "block" : "hidden"} lg:block lg:w-64 flex-shrink-0`}>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm min-h-[calc(100vh-8rem)]">
            <h2 className="font-bold text-gray-900 text-lg mb-6">Menu</h2>
            <nav className="space-y-2">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setActive(s.id); setMobileMenuOpen(false); }}
                  className={`w-full text-left block py-3 px-4 rounded-lg border-l-4 transition ${
                    active === s.id
                      ? "bg-blue-50 border-[#00B2FF] text-[#00B2FF]"
                      : "border-transparent text-gray-700 hover:bg-gray-50 hover:border-blue-300"
                  }`}
                >
                  <div className="font-medium">{s.title}</div>
                  <div className={`text-sm ${active === s.id ? "text-[#00B2FF]" : "text-gray-500"}`}>
                    {s.subtitle}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className={`flex-1 ${mobileMenuOpen ? "hidden lg:block" : ""}`}>
          {active === "dashboard" && !hasAgents && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Agent Dashboard</h1>
              </div>

              {/* Empty state */}
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-[#00B2FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No agents connected yet</h2>
                <p className="text-gray-500 mb-8 max-w-md">
                  Connect or deploy your first AI agent to start tracking performance, cost, and compliance from one dashboard.
                </p>
                <div className="flex gap-4">
                  <Link href="/demo" className="bg-[#00B2FF] text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-[#0099E6] transition">
                    View Demo
                  </Link>
                  <button
                    onClick={() => setActive("onboard")}
                    className="border border-gray-300 text-gray-700 rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Deploy an Agent
                  </button>
                </div>
              </div>
            </div>
          )}

          {active !== "dashboard" && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {SECTIONS.find((s) => s.id === active)?.title}
              </h1>
              <p className="text-gray-500 text-lg">
                {active === "onboard" && "Onboarding flow coming soon — add new agents here."}
                {active === "performance" && "Performance analytics coming soon — track agent output and quality."}
                {active === "compensation" && "Compensation management coming soon — set budgets and track spend."}
                {active === "policy" && "Policy engine coming soon — define guardrails for your agents."}
                {active === "offboarding" && "Offboarding coming soon — archive and audit agent activity."}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

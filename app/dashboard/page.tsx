"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type TabId = "overview" | "onboard" | "performance" | "compensation" | "policy" | "offboarding";

const TABS: { id: TabId; title: string; subtitle: string }[] = [
  { id: "overview", title: "Overview", subtitle: "Active agents & summary" },
  { id: "onboard", title: "Onboard", subtitle: "Add a new AI agent" },
  { id: "performance", title: "Performance", subtitle: "Tasks, errors, satisfaction" },
  { id: "compensation", title: "Compensation", subtitle: "API spend & budgets" },
  { id: "policy", title: "Policy", subtitle: "Guardrails & compliance" },
  { id: "offboarding", title: "Offboarding", subtitle: "Archive & audit" },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [hasAgents, setHasAgents] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user has any agents connected
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setHasAgents(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="sticky top-0 w-full z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <img src="/assets/logo_black_with_name.png" className="h-8 w-auto object-contain" alt="SynthForce" />
            </Link>
            <span className="font-bold text-lg text-gray-900">SynthForce</span>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-4 py-1.5">
            Log Out
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? "border-[#00B2FF] text-[#00B2FF]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {!hasAgents ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
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
                onClick={() => setActiveTab("onboard")}
                className="border border-gray-300 text-gray-700 rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
              >
                Deploy an Agent
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Total Agents</p>
                <p className="text-3xl font-bold text-gray-900">--</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Monthly Spend</p>
                <p className="text-3xl font-bold text-gray-900">--</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Total Tasks</p>
                <p className="text-3xl font-bold text-gray-900">--</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Efficiency Score</p>
                <p className="text-3xl font-bold text-gray-900">--</p>
              </div>
            </div>
          </>
        )}

        {activeTab !== "overview" && (
          <div className="flex items-center justify-center h-64 text-gray-400 text-lg">
            {activeTab === "onboard" && "Onboarding flow coming soon — add new agents here."}
            {activeTab === "performance" && "Performance analytics coming soon — track agent output and quality."}
            {activeTab === "compensation" && "Compensation management coming soon — set budgets and track spend."}
            {activeTab === "policy" && "Policy engine coming soon — define guardrails for your agents."}
            {activeTab === "offboarding" && "Offboarding coming soon — archive and audit agent activity."}
          </div>
        )}
      </div>
    </div>
  );
}

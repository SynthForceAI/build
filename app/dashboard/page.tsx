"use client";

import { useState } from "react";
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

const AGENTS = [
  { name: "Lead Qualifier", role: "Sales", status: "Active", cost: "$0.09/call", tasks: "2,150", budget: "$2,400", spent: "$1,890", dot: "bg-green-500", badge: "bg-green-100 text-green-800" },
  { name: "Support Agent", role: "Support", status: "Active", cost: "$0.12/call", tasks: "8,540", budget: "$4,800", spent: "$3,200", dot: "bg-green-500", badge: "bg-green-100 text-green-800" },
  { name: "Escalation Specialist", role: "Support", status: "Paused", cost: "$0.15/call", tasks: "1,230", budget: "$1,200", spent: "$560", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800" },
  { name: "Invoice Processor", role: "Finance", status: "Over Budget", cost: "$0.45/call", tasks: "3,210", budget: "$2,000", spent: "$2,450", dot: "bg-red-500", badge: "bg-red-100 text-red-800" },
  { name: "Expense Auditor", role: "Finance", status: "Training", cost: "$0.22/call", tasks: "890", budget: "$1,500", spent: "$420", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-800" },
  { name: "Content Writer", role: "Marketing", status: "Active", cost: "$0.18/call", tasks: "4,100", budget: "$3,000", spent: "$2,100", dot: "bg-green-500", badge: "bg-green-100 text-green-800" },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const router = useRouter();

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
              <img src="/assets/logo_homepage.png" className="h-8 w-auto object-contain" alt="SynthForce" />
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
        {activeTab === "overview" && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Total Agents</p>
                <p className="text-3xl font-bold text-gray-900">6</p>
                <p className="text-xs text-green-600 mt-1">+2 this month</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Monthly Spend</p>
                <p className="text-3xl font-bold text-gray-900">$10,620</p>
                <p className="text-xs text-red-600 mt-1">+12% vs last month</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Total Tasks</p>
                <p className="text-3xl font-bold text-gray-900">20,120</p>
                <p className="text-xs text-green-600 mt-1">+8% vs last month</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Efficiency Score</p>
                <p className="text-3xl font-bold text-gray-900">82%</p>
                <p className="text-xs text-yellow-600 mt-1">Needs attention</p>
              </div>
            </div>

            {/* Agents Table */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Your AI Agents</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="px-6 py-3 font-medium">Agent</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Cost</th>
                      <th className="px-6 py-3 font-medium">Tasks</th>
                      <th className="px-6 py-3 font-medium">Budget</th>
                      <th className="px-6 py-3 font-medium">Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AGENTS.map((agent) => (
                      <tr key={agent.name} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${agent.dot}`} />
                            <span className="font-medium text-gray-900">{agent.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{agent.role}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${agent.badge}`}>
                            {agent.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{agent.cost}</td>
                        <td className="px-6 py-4 text-gray-600">{agent.tasks}</td>
                        <td className="px-6 py-4 text-gray-600">{agent.budget}</td>
                        <td className="px-6 py-4 text-gray-900 font-medium">{agent.spent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

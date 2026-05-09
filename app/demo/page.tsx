"use client";

import { useState } from "react";
import { DemoPageNavbar } from "@/components/ui/navbars";

type SectionId =
  | "dashboard"
  | "onboard"
  | "performance"
  | "compensation"
  | "policy"
  | "offboarding";

const SECTIONS: { id: SectionId; title: string; subtitle: string }[] = [
  { id: "dashboard", title: "Dashboard", subtitle: "Active agents & overview" },
  { id: "onboard", title: "Onboard", subtitle: "Add a new AI agent" },
  { id: "performance", title: "Agent Performance", subtitle: "Tasks, errors, satisfaction" },
  { id: "compensation", title: "Agent Compensation", subtitle: "API spend, ROI, payroll" },
  { id: "policy", title: "Agent Policy", subtitle: "Guardrails & compliance" },
  { id: "offboarding", title: "Agent Offboarding", subtitle: "Archive & audit" },
];

type AgentModalData = {
  name: string;
  role: string;
  dept: string;
  status: string;
  cost: string;
  tasks: string;
};

type AgentCard = AgentModalData & { dotColor: string; pillColor: string };

const AGENTS: AgentCard[] = [
  {
    name: "Lead Qualifier",
    role: "Lead Qualifier",
    dept: "Sales",
    status: "Active",
    cost: "$0.09",
    tasks: "2,150",
    dotColor: "bg-green-500",
    pillColor: "bg-green-100 text-green-800",
  },
  {
    name: "Support Agent",
    role: "Support Lead",
    dept: "Support",
    status: "Paused",
    cost: "$0.12",
    tasks: "8,540",
    dotColor: "bg-yellow-500",
    pillColor: "bg-yellow-100 text-yellow-800",
  },
  {
    name: "Escalation Specialist",
    role: "Escalation Specialist",
    dept: "Support",
    status: "Active",
    cost: "$0.15",
    tasks: "1,230",
    dotColor: "bg-green-500",
    pillColor: "bg-green-100 text-green-800",
  },
  {
    name: "Invoice Processor",
    role: "Finance",
    dept: "Finance",
    status: "Over Budget",
    cost: "$0.45",
    tasks: "3,210",
    dotColor: "bg-red-500",
    pillColor: "bg-red-100 text-red-800",
  },
  {
    name: "Expense Auditor",
    role: "Finance",
    dept: "Finance",
    status: "Training",
    cost: "$0.22",
    tasks: "890",
    dotColor: "bg-blue-500",
    pillColor: "bg-blue-100 text-blue-800",
  },
  {
    name: "Sales Representative",
    role: "Sales",
    dept: "Sales",
    status: "Active",
    cost: "$0.07",
    tasks: "4,560",
    dotColor: "bg-green-500",
    pillColor: "bg-green-100 text-green-800",
  },
];

export default function DemoPage() {
  const [active, setActive] = useState<SectionId>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(true); // mobile-only: true = card menu, false = section view
  const [onboardView, setOnboardView] = useState<"choice" | "new" | "existing">("choice");
  const [budget, setBudget] = useState(2000);
  const [agentModal, setAgentModal] = useState<AgentModalData | null>(null);

  const currentIndex = SECTIONS.findIndex((s) => s.id === active);
  const goPrev = () => {
    if (currentIndex === 0) {
      setMobileMenuOpen(true);
    } else {
      setActive(SECTIONS[currentIndex - 1].id);
    }
  };
  const goNext = () => {
    if (currentIndex < SECTIONS.length - 1) setActive(SECTIONS[currentIndex + 1].id);
  };
  const selectSection = (id: SectionId) => {
    setActive(id);
    setMobileMenuOpen(false);
  };

  const handleTransfer = (agent: string, dept: string) => {
    alert(`Transfer ${agent} from ${dept} to another department? This is a demo.`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DemoPageNavbar />

      <div className="container mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Mobile-only card menu (hidden on lg+) */}
        {mobileMenuOpen && (
          <div className="lg:hidden mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Menu</h2>
              <p className="text-gray-600 mb-6">Tap a section to view it.</p>
              <div className="space-y-4">
                {SECTIONS.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => selectSection(s.id)}
                    className="border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow cursor-pointer"
                  >
                    <div className="font-bold text-gray-900 text-lg">{s.title}</div>
                    <div className="text-sm text-gray-600">{s.subtitle}</div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-gray-500">
                This is a simulated demo. Data is not real.
              </p>
            </div>
          </div>
        )}

        {/* Mobile-only section header */}
        {!mobileMenuOpen && (
          <div className="lg:hidden mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between relative">
              <button
                onClick={goPrev}
                className="text-gray-700 hover:text-blue-600 p-2"
                aria-label="Previous"
              >
                {currentIndex === 0 ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                )}
              </button>
              <div className="text-center">
                <div className="font-bold text-gray-900 text-lg">{SECTIONS[currentIndex].title}</div>
                <div className="text-sm text-gray-600">{SECTIONS[currentIndex].subtitle}</div>
              </div>
              {currentIndex < SECTIONS.length - 1 ? (
                <button
                  onClick={goNext}
                  className="text-gray-700 hover:text-blue-600 p-2"
                  aria-label="Next"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ) : (
                <span className="w-10" />
              )}
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <div className="hidden lg:block lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm min-h-[calc(100vh-4rem)]">
            <h2 className="font-bold text-gray-900 text-lg mb-6">Menu</h2>
            <nav className="space-y-2">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
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
            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500">This is a simulated demo. Data is not real.</p>
            </div>
          </div>
        </div>

        {/* Main content (hidden on mobile when menu is open) */}
        <div className={`flex-1 ${mobileMenuOpen ? "hidden lg:block" : ""}`}>
          {active === "dashboard" && (
            <section>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <h1 className="text-3xl font-bold text-gray-900">Agent Dashboard</h1>
                  <button
                    onClick={() => setActive("onboard")}
                    className="px-5 py-2.5 text-sm font-sans uppercase rounded-lg bg-[#00B2FF] text-white border border-[#00B2FF] hover:bg-transparent hover:text-[#00B2FF] transition"
                  >
                    Onboard New Agent
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                  <Stat value="6" label="Active Agents" tone="bg-blue-50" />
                  <Stat value="1,248" label="Tasks Completed (30d)" tone="bg-green-50" />
                  <Stat value="$2,840" label="Monthly API Spend" tone="bg-purple-50" />
                  <Stat value="98.2%" label="Satisfaction Score" tone="bg-yellow-50" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Agent Directory</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {AGENTS.map((agent) => (
                    <div
                      key={agent.name}
                      onClick={() => setAgentModal(agent)}
                      className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:-translate-y-0.5 transition-transform"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${agent.dotColor}`} />
                          <span className="font-sans font-bold text-gray-900">{agent.name}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-mono ${agent.pillColor}`}>
                          {agent.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">Role: {agent.role}</div>
                      <div className="text-sm text-gray-600 mb-2">Department: {agent.dept}</div>
                      <div className="text-sm font-mono text-gray-900">Cost per task: {agent.cost}</div>
                      <div className="mt-4 text-xs text-gray-500">Tasks completed: {agent.tasks}</div>
                    </div>
                  ))}
                </div>

                <ReturnToMenu onClick={() => setMobileMenuOpen(true)} />
              </div>
            </section>
          )}

          {active === "onboard" && (
            <section>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Onboard AI Agents</h1>
                <p className="text-gray-600 mb-8">
                  Choose how you&rsquo;d like to add an agent to your SynthForce dashboard.
                </p>

                {onboardView === "choice" && (
                  <div className="max-w-3xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      <div
                        onClick={() => setOnboardView("new")}
                        className="border border-gray-200 rounded-2xl p-8 hover:border-blue-300 hover:shadow-lg transition cursor-pointer flex flex-col h-full"
                      >
                        <div className="text-blue-600 mb-4">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Deploy a New Agent</h3>
                        <p className="text-gray-600 mb-6">
                          Create a brand‑new AI agent from scratch. Choose department, budget, guardrails, and deploy in minutes.
                        </p>
                        <div className="text-sm text-gray-500">
                          <ul className="list-disc pl-5 space-y-1">
                            <li>Full control over role and permissions</li>
                            <li>Built‑in cost tracking from day one</li>
                            <li>Pre‑configured guardrails</li>
                          </ul>
                        </div>
                        <button className="mt-auto px-6 py-3 w-full bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                          Start Building
                        </button>
                      </div>
                      <div
                        onClick={() => setOnboardView("existing")}
                        className="border border-gray-200 rounded-2xl p-8 hover:border-purple-300 hover:shadow-lg transition cursor-pointer flex flex-col h-full"
                      >
                        <div className="text-purple-600 mb-4">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Connect an Existing Agent</h3>
                        <p className="text-gray-600 mb-6">
                          Already have agents running on OpenAI, Anthropic, or other platforms? Wrap them with SynthForce in minutes.
                        </p>
                        <div className="text-sm text-gray-500">
                          <ul className="list-disc pl-5 space-y-1">
                            <li>Works with 10+ AI providers</li>
                            <li>No code changes required</li>
                            <li>Add oversight without disrupting workflows</li>
                          </ul>
                        </div>
                        <button className="mt-auto px-6 py-3 w-full bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                          Connect Now
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 text-center">
                      Both options include full monitoring, cost tracking, policy enforcement, and offboarding workflows.
                    </p>
                  </div>
                )}

                {onboardView === "new" && (
                  <div className="max-w-3xl">
                    <div className="flex items-center mb-4">
                      <button
                        onClick={() => setOnboardView("choice")}
                        className="text-gray-600 hover:text-gray-900 mr-4"
                      >
                        ← Back
                      </button>
                      <h2 className="text-2xl font-bold text-gray-900">Deploy a New AI Agent</h2>
                    </div>
                    <p className="text-gray-600 mb-8">
                      Create a brand‑new AI agent from scratch. Choose department, budget, guardrails, and deploy in minutes.
                    </p>
                    <div className="space-y-6">
                      <Field label="Department">
                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="Sales">
                          <option>Sales</option>
                          <option>Support</option>
                          <option>Finance</option>
                          <option>Marketing</option>
                        </select>
                      </Field>
                      <Field label="Role Title">
                        <input
                          type="text"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                          placeholder="e.g., Lead Qualifier"
                        />
                      </Field>
                      <Field label="Monthly Budget">
                        <input
                          type="range"
                          min={100}
                          max={5000}
                          step={100}
                          value={budget}
                          onChange={(e) => setBudget(Number(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                        <div className="flex justify-between text-sm text-gray-500 mt-2">
                          <span>$100</span>
                          <span>$2,500</span>
                          <span>$5,000</span>
                        </div>
                        <p className="mt-2 text-lg font-semibold text-gray-900">
                          ${budget.toLocaleString()} / month
                        </p>
                      </Field>
                      <Field label="Guardrail Policy">
                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="No discounts greater than 5%">
                          <option>No discounts greater than 5%</option>
                          <option>No sharing of PII</option>
                          <option>No promises of future features</option>
                          <option>No refunds without manager approval</option>
                        </select>
                      </Field>
                      <div className="pt-6 border-t">
                        <button className="w-full px-6 py-3 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                          Deploy AI Agent
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {onboardView === "existing" && (
                  <div className="max-w-3xl">
                    <div className="flex items-center mb-8">
                      <button
                        onClick={() => setOnboardView("choice")}
                        className="text-gray-600 hover:text-gray-900 mr-4"
                      >
                        ← Back
                      </button>
                      <h2 className="text-2xl font-bold text-gray-900">Connect an Existing Agent</h2>
                    </div>
                    <p className="text-gray-600 mb-8">
                      Already have agents running on OpenAI, Anthropic, or other platforms? Wrap them with SynthForce in minutes.
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-gray-50 p-6 rounded-xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">API Integration</h3>
                        <div className="space-y-6">
                          <Field label="AI Provider">
                            <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="OpenAI">
                              <option>OpenAI</option>
                              <option>Anthropic</option>
                              <option>Google Gemini</option>
                              <option>Azure AI</option>
                              <option>Llama</option>
                              <option>Cohere</option>
                              <option>Hugging Face</option>
                              <option>DeepSeek</option>
                              <option>Groq</option>
                              <option>Custom API</option>
                            </select>
                          </Field>
                          <Field label="API Key (simulated)">
                            <input
                              type="password"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                              placeholder="sk-..."
                            />
                            <p className="text-xs text-gray-500 mt-2">
                              We never store your keys. They are used only for secure routing.
                            </p>
                          </Field>
                          <Field label="Agent Name (in your system)">
                            <input
                              type="text"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                              placeholder="e.g., sales-bot-01"
                            />
                          </Field>
                          <Field label="Assign Department">
                            <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="Sales">
                              <option>Sales</option>
                              <option>Support</option>
                              <option>Finance</option>
                              <option>Marketing</option>
                            </select>
                          </Field>
                          <button className="w-full px-6 py-3 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                            Connect Agent
                          </button>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Recently Connected</h3>
                        <div className="space-y-4">
                          <ConnectedAgent name="lead‑gen‑v2" detail="OpenAI · Sales" status="Active" statusTone="bg-green-100 text-green-800" footer="Connected 2 days ago · 1,240 tasks monitored" />
                          <ConnectedAgent name="support‑claude" detail="Anthropic · Support" status="Active" statusTone="bg-green-100 text-green-800" footer="Connected 1 week ago · 5,832 tasks monitored" />
                          <ConnectedAgent name="invoice‑gemini" detail="Gemini · Finance" status="Pending" statusTone="bg-yellow-100 text-yellow-800" footer="Connecting... · API key verified" />
                        </div>
                        <p className="mt-6 text-sm text-gray-500">
                          SynthForce wraps your existing agents with oversight; cost tracking, policy enforcement, and performance monitoring, without disrupting your workflows.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <ReturnToMenu onClick={() => setMobileMenuOpen(true)} />
              </div>
            </section>
          )}

          {active === "performance" && (
            <section>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Agents</h1>
                <p className="text-gray-600 mb-8">
                  Monitor performance, transfer agents across departments, and dive into errors.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                  <Stat value="94.7%" label="Success Rate" tone="bg-blue-50" />
                  <Stat value="142" label="Errors (30d)" tone="bg-green-50" />
                  <Stat value="8.2s" label="Avg. Response Time" tone="bg-purple-50" />
                  <Stat value="4.7" label="Avg. User Rating" tone="bg-yellow-50" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Agent Performance</h2>
                <div className="overflow-x-auto mb-10">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Tasks Completed</th>
                        <th className="px-4 py-3">Error Rate</th>
                        <th className="px-4 py-3">Satisfaction</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <PerfRow agent="Lead Qualifier" dept="Sales" tasks="2,150" errorRate="1.2%" errorTone="bg-green-100 text-green-800" rating="4.9 ★" onTransfer={() => handleTransfer("Lead Qualifier", "Sales")} />
                      <PerfRow agent="Support Agent" dept="Support" tasks="8,540" errorRate="3.8%" errorTone="bg-yellow-100 text-yellow-800" rating="4.5 ★" onTransfer={() => handleTransfer("Support Agent", "Support")} />
                      <PerfRow agent="Invoice Processor" dept="Finance" tasks="3,210" errorRate="7.5%" errorTone="bg-red-100 text-red-800" rating="3.8 ★" onTransfer={() => handleTransfer("Invoice Processor", "Finance")} />
                    </tbody>
                  </table>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Error Deep Dive</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                  <div className="bg-red-50 p-6 rounded-xl">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Errors</h3>
                    <ul className="space-y-4">
                      <ErrorItem agent="Invoice Processor" desc="Failed to parse invoice date; manual review required." time="2 hours ago" />
                      <ErrorItem agent="Support Agent" desc="Customer query escalated incorrectly; routed to wrong department." time="5 hours ago" />
                      <ErrorItem agent="Lead Qualifier" desc="Duplicate lead entry; system flagged as duplicate but agent proceeded." time="1 day ago" />
                    </ul>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-xl">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Transfer Agent</h3>
                    <div className="space-y-4">
                      <Field label="Select Agent" labelTone="text-gray-700">
                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="Lead Qualifier (Sales)">
                          <option>Lead Qualifier (Sales)</option>
                          <option>Support Agent (Support)</option>
                          <option>Invoice Processor (Finance)</option>
                        </select>
                      </Field>
                      <Field label="Target Department" labelTone="text-gray-700">
                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="Marketing">
                          <option>Marketing</option>
                          <option>Sales</option>
                          <option>Support</option>
                          <option>Finance</option>
                        </select>
                      </Field>
                      <Field label="Reason for Transfer" labelTone="text-gray-700">
                        <textarea
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                          rows={2}
                          placeholder="e.g., Marketing needs lead data for campaign analysis"
                        />
                      </Field>
                      <button className="w-full py-3 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                        Initiate Transfer
                      </button>
                    </div>
                  </div>
                </div>

                <ReturnToMenu onClick={() => setMobileMenuOpen(true)} />
              </div>
            </section>
          )}

          {active === "compensation" && (
            <section>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Compensation</h1>
                <p className="text-gray-600 mb-8">
                  Monitors API spend, calculates ROI, recommends optimizations. Shows the &ldquo;payroll&rdquo; for your synthetic team.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <StatWithDelta value="$2,840" label="Monthly Spend" delta="+12% from last month" deltaTone="text-green-600" tone="bg-blue-50" />
                  <StatWithDelta value="$18.5k" label="Estimated ROI (30d)" delta="+24% efficiency" deltaTone="text-green-600" tone="bg-green-50" />
                  <StatWithDelta value="$0.58" label="Avg. Cost per Task" delta="+$0.02 vs target" deltaTone="text-red-600" tone="bg-purple-50" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Cost Breakdown by Agent</h2>
                <div className="overflow-x-auto mb-10">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Monthly Cost</th>
                        <th className="px-4 py-3">Tasks Completed</th>
                        <th className="px-4 py-3">Cost per Task</th>
                        <th className="px-4 py-3">ROI Score</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <CostRow agent="Lead Qualifier" dept="Sales" cost="$420" tasks="2,150" cpt="$0.20" roi="High" roiTone="bg-green-100 text-green-800" />
                      <CostRow agent="Support Agent" dept="Support" cost="$1,020" tasks="8,540" cpt="$0.12" roi="High" roiTone="bg-green-100 text-green-800" />
                      <CostRow agent="Invoice Processor" dept="Finance" cost="$890" tasks="3,210" cpt="$0.28" roi="Medium" roiTone="bg-yellow-100 text-yellow-800" />
                      <CostRow agent="Expense Auditor" dept="Finance" cost="$510" tasks="890" cpt="$0.57" roi="Low" roiTone="bg-red-100 text-red-800" />
                    </tbody>
                  </table>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Optimization Recommendations</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-green-50 p-6 rounded-xl">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Switch Model for Expense Auditor</h3>
                    <p className="text-gray-700 mb-4">
                      Expense Auditor currently uses GPT‑4o. Switching to Claude 3 Haiku could reduce cost per task by ~40% with minimal accuracy loss.
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Estimated monthly savings: <strong>$204</strong>
                      </span>
                      <button className="px-4 py-2 text-sm bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                        Apply
                      </button>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-xl">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Batch Processing for Invoice Processor</h3>
                    <p className="text-gray-700 mb-4">
                      Invoice Processor processes each invoice individually. Enabling batch processing could reduce API calls by 30%.
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Estimated monthly savings: <strong>$267</strong>
                      </span>
                      <button className="px-4 py-2 text-sm bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                        Apply
                      </button>
                    </div>
                  </div>
                </div>

                <ReturnToMenu onClick={() => setMobileMenuOpen(true)} />
              </div>
            </section>
          )}

          {active === "policy" && (
            <section>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Policy</h1>
                <p className="text-gray-600 mb-8">
                  Enforces guardrails (no unauthorized promises, no PII access) in real‑time. Policies are written in plain English, not code.
                </p>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Policy Builder</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                  <div className="lg:col-span-2">
                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Policy</h3>
                      <div className="space-y-4">
                        <Field label="Select Department" labelTone="text-gray-700">
                          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="Sales">
                            <option>Sales</option>
                            <option>Support</option>
                            <option>Finance</option>
                            <option>Marketing</option>
                            <option>All Departments</option>
                          </select>
                        </Field>
                        <Field label="Policy Type" labelTone="text-gray-700">
                          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="Data Privacy">
                            <option>Data Privacy</option>
                            <option>Financial Guardrails</option>
                            <option>Communication Rules</option>
                            <option>Compliance</option>
                          </select>
                        </Field>
                        <Field label="Policy Description (Plain English)" labelTone="text-gray-700">
                          <textarea
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                            rows={3}
                            placeholder="e.g., Agents must never promise discounts greater than 5% without manager approval."
                          />
                        </Field>
                        <Field label="Severity" labelTone="text-gray-700">
                          <div className="flex gap-4">
                            <label className="inline-flex items-center">
                              <input type="radio" name="severity" defaultChecked className="text-blue-600" />
                              <span className="ml-2">Low</span>
                            </label>
                            <label className="inline-flex items-center">
                              <input type="radio" name="severity" className="text-yellow-600" />
                              <span className="ml-2">Medium</span>
                            </label>
                            <label className="inline-flex items-center">
                              <input type="radio" name="severity" className="text-red-600" />
                              <span className="ml-2">High</span>
                            </label>
                          </div>
                        </Field>
                        <button className="w-full py-3 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                          Save Policy
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Existing Policies by Department</h3>
                    <div className="space-y-4">
                      <PolicyGroup
                        dept="Sales"
                        items={[
                          { dot: "bg-green-500", text: "No discounts >5% without approval" },
                          { dot: "bg-green-500", text: "Never share future roadmap dates" },
                        ]}
                      />
                      <PolicyGroup
                        dept="Support"
                        items={[
                          { dot: "bg-green-500", text: "Do not access PII without consent" },
                          { dot: "bg-yellow-500", text: "Escalate angry customers within 2 messages" },
                        ]}
                      />
                      <PolicyGroup
                        dept="Finance"
                        items={[
                          { dot: "bg-green-500", text: "Never approve invoices over $10k without audit" },
                          { dot: "bg-red-500", text: "Flag duplicate expense entries" },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Policy Violations</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Policy Violated</th>
                        <th className="px-4 py-3">Severity</th>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <ViolationRow agent="Support Agent" dept="Support" policy="Accessed customer PII without consent" severity="High" severityTone="bg-red-100 text-red-800" time="2 hours ago" />
                      <ViolationRow agent="Lead Qualifier" dept="Sales" policy="Promised 10% discount without approval" severity="Medium" severityTone="bg-yellow-100 text-yellow-800" time="1 day ago" />
                      <ViolationRow agent="Invoice Processor" dept="Finance" policy="Processed invoice over $10k without audit flag" severity="High" severityTone="bg-red-100 text-red-800" time="2 days ago" />
                    </tbody>
                  </table>
                </div>

                <ReturnToMenu onClick={() => setMobileMenuOpen(true)} />
              </div>
            </section>
          )}

          {active === "offboarding" && (
            <section>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Offboarding</h1>
                <p className="text-gray-600 mb-8">
                  Archives logs, revokes permissions, generates audit trails. Just like exiting a human employee.
                </p>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Offboarding Checklist</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="bg-gray-50 p-6 rounded-xl">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Initiate Offboarding</h3>
                    <div className="space-y-4">
                      <Checkbox label="Archive all conversation logs" />
                      <Checkbox label="Revoke API access keys" />
                      <Checkbox label="Notify downstream integrations" />
                      <Checkbox label="Generate compliance audit trail" />
                      <Checkbox label="Transfer pending tasks to another agent" />
                      <div className="pt-4">
                        <button className="w-full py-3 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                          Complete Offboarding
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Select Agent to Offboard</h3>
                    <div className="space-y-4">
                      <Field label="Agent" labelTone="text-gray-700">
                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="Lead Qualifier (Sales)">
                          <option>Lead Qualifier (Sales)</option>
                          <option>Support Agent (Support)</option>
                          <option>Invoice Processor (Finance)</option>
                          <option>Expense Auditor (Finance)</option>
                        </select>
                      </Field>
                      <Field label="Reason" labelTone="text-gray-700">
                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="Cost optimization">
                          <option>Cost optimization</option>
                          <option>Performance issues</option>
                          <option>Department restructuring</option>
                          <option>Security compliance</option>
                        </select>
                      </Field>
                      <Field label="Final Access Date" labelTone="text-gray-700">
                        <input type="date" className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="2026-05-01" />
                      </Field>
                      <Field label="Notes" labelTone="text-gray-700">
                        <textarea
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                          rows={2}
                          placeholder="Add context for offboarding..."
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Archived Agents</h2>
                <div className="overflow-x-auto mb-10">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Archived On</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Logs Archived</th>
                        <th className="px-4 py-3">Access Revoked</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <ArchivedRow agent="Social Media Monitor" dept="Marketing" date="2026-03-15" reason="Cost optimization" logs revoked actionLabel="Restore" />
                      <ArchivedRow agent="Customer Feedback Analyzer" dept="Support" date="2026-02-28" reason="Performance issues" logs revoked actionLabel="Restore" />
                      <ArchivedRow agent="Expense Report Generator" dept="Finance" date="2026-01-10" reason="Department restructuring" logs revoked={false} actionLabel="Revoke Now" />
                    </tbody>
                  </table>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-6">Audit Trail Generator</h2>
                <div className="bg-gray-50 p-6 rounded-xl">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Generate Compliance Report</h3>
                      <p className="text-gray-600 mb-4">
                        Create a detailed audit trail for compliance (SOC 2, ISO 27001, GDPR).
                      </p>
                      <div className="space-y-4">
                        <Field label="Time Range" labelTone="text-gray-700">
                          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg" defaultValue="Last 30 days">
                            <option>Last 30 days</option>
                            <option>Last quarter</option>
                            <option>Last year</option>
                            <option>Custom range</option>
                          </select>
                        </Field>
                        <Field label="Include" labelTone="text-gray-700">
                          <div className="space-y-2">
                            <label className="inline-flex items-center">
                              <input type="checkbox" defaultChecked className="text-blue-600 rounded" />
                              <span className="ml-2 text-gray-700">Access logs</span>
                            </label>
                            <label className="inline-flex items-center">
                              <input type="checkbox" defaultChecked className="text-blue-600 rounded" />
                              <span className="ml-2 text-gray-700">Policy violations</span>
                            </label>
                            <label className="inline-flex items-center">
                              <input type="checkbox" className="text-blue-600 rounded" />
                              <span className="ml-2 text-gray-700">Cost breakdowns</span>
                            </label>
                          </div>
                        </Field>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Audit Trail</h3>
                      <div className="space-y-4">
                        <div className="bg-white p-4 rounded-lg border">
                          <div className="font-medium text-gray-900">Q1 2026 Compliance Report</div>
                          <div className="text-sm text-gray-600 mt-1">Generated on 2026-04-01 • 842 events</div>
                          <div className="mt-2">
                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Download PDF</button>
                            <button className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium">View Online</button>
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg border">
                          <div className="font-medium text-gray-900">Support Agent Offboarding Audit</div>
                          <div className="text-sm text-gray-600 mt-1">Generated on 2026-03-15 • 312 events</div>
                          <div className="mt-2">
                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Download PDF</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t">
                    <button className="px-6 py-3 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition">
                      Generate New Audit Report
                    </button>
                  </div>
                </div>

                <ReturnToMenu onClick={() => setMobileMenuOpen(true)} />
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 py-8 border-t border-gray-200 bg-gray-50">
        <div className="container mx-auto px-6 text-center text-gray-600 text-sm">
          <p>
            2026 SynthForce AI. All rights reserved. |{" "}
            <a href="/" className="text-blue-600 hover:underline">Home</a> |{" "}
            <a href="/product" className="text-blue-600 hover:underline">Product</a> |{" "}
            <a href="/demo" className="text-blue-600 hover:underline">Demo</a> |{" "}
            <a href="/blog" className="text-blue-600 hover:underline">Blog</a> |{" "}
            <a href="/about" className="text-blue-600 hover:underline">About</a> |{" "}
            <a href="/waitlistsignup" className="text-blue-600 hover:underline">Waitlist</a>
          </p>
          <p className="mt-2 text-xs text-gray-500">This is a simulated demo. Data is not real.</p>
        </div>
      </footer>

      {/* Agent details modal */}
      {agentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              aria-hidden="true"
              onClick={() => setAgentModal(null)}
            />
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative">
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">{agentModal.name}</h3>
                  <button
                    onClick={() => setAgentModal(null)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Close"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <ModalRow label="Role:" value={agentModal.role} />
                  <ModalRow label="Department:" value={agentModal.dept} />
                  <div>
                    <span className="text-sm text-gray-500">Status:</span>
                    <span className="ml-2 px-3 py-1 rounded-full text-xs font-mono bg-green-100 text-green-800">
                      {agentModal.status}
                    </span>
                  </div>
                  <ModalRow label="Cost per task:" value={agentModal.cost} mono />
                  <ModalRow label="Tasks completed:" value={agentModal.tasks} mono />
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setAgentModal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Close
                </button>
                <button className="ml-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                  Edit Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className={`${tone} p-6 rounded-xl`}>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

function StatWithDelta({
  value,
  label,
  delta,
  deltaTone,
  tone,
}: {
  value: string;
  label: string;
  delta: string;
  deltaTone: string;
  tone: string;
}) {
  return (
    <div className={`${tone} p-6 rounded-xl`}>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-xs ${deltaTone} mt-1`}>{delta}</div>
    </div>
  );
}

function Field({
  label,
  labelTone = "text-gray-900",
  children,
}: {
  label: string;
  labelTone?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={`block text-sm font-medium ${labelTone} mb-2`}>{label}</label>
      {children}
    </div>
  );
}

function ConnectedAgent({
  name,
  detail,
  status,
  statusTone,
  footer,
}: {
  name: string;
  detail: string;
  status: string;
  statusTone: string;
  footer: string;
}) {
  return (
    <div className="bg-white border border-gray-200 p-4 rounded-xl">
      <div className="flex justify-between items-center">
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-600">{detail}</div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs ${statusTone}`}>{status}</span>
      </div>
      <div className="mt-2 text-xs text-gray-500">{footer}</div>
    </div>
  );
}

function PerfRow({
  agent,
  dept,
  tasks,
  errorRate,
  errorTone,
  rating,
  onTransfer,
}: {
  agent: string;
  dept: string;
  tasks: string;
  errorRate: string;
  errorTone: string;
  rating: string;
  onTransfer: () => void;
}) {
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-3 font-medium">{agent}</td>
      <td className="px-4 py-3">{dept}</td>
      <td className="px-4 py-3">{tasks}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded-full text-xs ${errorTone}`}>{errorRate}</span>
      </td>
      <td className="px-4 py-3">{rating}</td>
      <td className="px-4 py-3">
        <button onClick={onTransfer} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          Transfer
        </button>
      </td>
    </tr>
  );
}

function ErrorItem({ agent, desc, time }: { agent: string; desc: string; time: string }) {
  return (
    <li>
      <div className="font-medium text-gray-900">{agent}</div>
      <div className="text-sm text-gray-600">{desc}</div>
      <div className="text-xs text-gray-500 mt-1">{time}</div>
    </li>
  );
}

function CostRow({
  agent,
  dept,
  cost,
  tasks,
  cpt,
  roi,
  roiTone,
}: {
  agent: string;
  dept: string;
  cost: string;
  tasks: string;
  cpt: string;
  roi: string;
  roiTone: string;
}) {
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-3 font-medium">{agent}</td>
      <td className="px-4 py-3">{dept}</td>
      <td className="px-4 py-3">{cost}</td>
      <td className="px-4 py-3">{tasks}</td>
      <td className="px-4 py-3">{cpt}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded-full text-xs ${roiTone}`}>{roi}</span>
      </td>
      <td className="px-4 py-3">
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Optimize</button>
      </td>
    </tr>
  );
}

function PolicyGroup({
  dept,
  items,
}: {
  dept: string;
  items: { dot: string; text: string }[];
}) {
  return (
    <div className="bg-white border border-gray-200 p-4 rounded-xl">
      <div className="font-medium text-gray-900">{dept}</div>
      <ul className="mt-2 space-y-2 text-sm text-gray-600">
        {items.map((item, i) => (
          <li key={i} className="flex items-center">
            <div className={`w-2 h-2 rounded-full ${item.dot} mr-2`} />
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ViolationRow({
  agent,
  dept,
  policy,
  severity,
  severityTone,
  time,
}: {
  agent: string;
  dept: string;
  policy: string;
  severity: string;
  severityTone: string;
  time: string;
}) {
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-3 font-medium">{agent}</td>
      <td className="px-4 py-3">{dept}</td>
      <td className="px-4 py-3">{policy}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded-full text-xs ${severityTone}`}>{severity}</span>
      </td>
      <td className="px-4 py-3">{time}</td>
      <td className="px-4 py-3">
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Review</button>
      </td>
    </tr>
  );
}

function Checkbox({ label }: { label: string }) {
  return (
    <div className="flex items-center">
      <input type="checkbox" className="h-5 w-5 text-blue-600 rounded" />
      <label className="ml-3 text-gray-700">{label}</label>
    </div>
  );
}

function ArchivedRow({
  agent,
  dept,
  date,
  reason,
  logs,
  revoked,
  actionLabel,
}: {
  agent: string;
  dept: string;
  date: string;
  reason: string;
  logs: boolean;
  revoked: boolean;
  actionLabel: string;
}) {
  const yesPill = "px-2 py-1 rounded-full text-xs bg-green-100 text-green-800";
  const noPill = "px-2 py-1 rounded-full text-xs bg-red-100 text-red-800";
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-3 font-medium">{agent}</td>
      <td className="px-4 py-3">{dept}</td>
      <td className="px-4 py-3">{date}</td>
      <td className="px-4 py-3">{reason}</td>
      <td className="px-4 py-3">
        <span className={logs ? yesPill : noPill}>{logs ? "Yes" : "No"}</span>
      </td>
      <td className="px-4 py-3">
        <span className={revoked ? yesPill : noPill}>{revoked ? "Yes" : "No"}</span>
      </td>
      <td className="px-4 py-3">
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">{actionLabel}</button>
      </td>
    </tr>
  );
}

function ModalRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`ml-2 ${mono ? "font-mono" : "font-medium"} text-gray-900`}>{value}</span>
    </div>
  );
}

function ReturnToMenu({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-12 pt-8 border-t border-gray-200 lg:hidden">
      <button
        onClick={onClick}
        className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-blue-300 transition"
      >
        ← Return to Menu
      </button>
    </div>
  );
}
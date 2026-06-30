"use client";

import { useState } from "react";
import { ProviderForm } from "./ProviderForm";
import { RecentlyConnected } from "./RecentlyConnected";

type Provider   = { id: string; name: string; displayName: string };
type Department = { id: string; name: string };
type Agent = {
  id:                  string;
  name:                string;
  providerName:        string;
  modelUsed:           string;
  status:              "pending" | "active" | "inactive";
  tasksMonitored:      number;
  totalCostCents:      number | string;
  connectedAt:         string;
  lastUsageReportedAt: string | null;
  department:          string | null;
};

type View = "choice" | "deploy" | "connect";

type Props = {
  providers:     Provider[];
  departments:   Department[];
  initialAgents: Agent[];
};

// ── Shared style tokens ────────────────────────────────────────────────────

const btnPrimary =
  "w-full px-6 py-3 bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition text-sm font-medium";

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-gray-600 hover:text-gray-900 transition flex items-center gap-1 mb-6"
    >
      ← Back
    </button>
  );
}

// ── Choice view ────────────────────────────────────────────────────────────

function ChoiceView({ onSelect }: { onSelect: (v: "deploy" | "connect") => void }) {
  return (
    <div className="max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">

        {/* Monitor card */}
        <button
          onClick={() => onSelect("connect")}
          className="border border-gray-200 rounded-md p-8 hover:border-blue-300 hover:shadow-lg transition cursor-pointer flex flex-col items-center text-center h-full"
        >
          <div className="text-[#00B2FF] mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">Monitor Your Agent Fleet</h3>
          <p className="text-sm text-gray-600 mb-2 font-medium text-[#00B2FF]">See your AI spending clearly.</p>
          <p className="text-sm text-gray-600 mb-5">
            Connect your existing API keys to see spending, trends, benchmarks, and savings recommendations.
          </p>
          <div className="space-y-2 mb-6 w-full">
            {[
              "Audit spending across all your agents",
              "See which models are costing the most",
              "Get optimization recommendations",
              "Org-level visibility (no code changes needed)",
            ].map((item) => (
              <div key={item} className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00B2FF] shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <span className={`mt-auto ${btnPrimary}`}>Connect Now</span>
        </button>

        {/* Proxy card - Phase 2 */}
        <div className="border border-gray-200 rounded-md p-8 flex flex-col items-center text-center h-full opacity-60 cursor-default">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">SynthForce Proxy Layer</h3>
          <p className="text-sm text-gray-500 mb-2 font-medium">Coming in Phase 2 (Sept 2026)</p>
          <p className="text-sm text-gray-500 mb-5">
            Route your agent traffic through SynthForce for real-time monitoring, budgets, and policy enforcement.
          </p>
          <div className="space-y-2 mb-6 w-full">
            {[
              "Real-time per-request cost tracking",
              "Set spend caps and approval gates",
              "Block or reroute requests by policy",
              "Per-agent usage breakdown",
            ].map((item) => (
              <div key={item} className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <span className="mt-auto w-full px-6 py-3 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg text-sm font-medium cursor-not-allowed">
            Coming in Phase 2
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Deploy view - Coming Soon ──────────────────────────────────────────────

function DeployView({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <div className="max-w-lg mx-auto">
        <div className="bg-blue-50 rounded-md p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-[#00B2FF]/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-[#00B2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Deploy a New Agent</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            We&rsquo;re building the ability to create and deploy new AI agents directly from SynthForce.
          </p>
          <p className="text-sm font-semibold text-[#00B2FF] mb-5">
            This feature launches in Phase 3.
          </p>
          <p className="text-sm text-gray-600">
            For now, connect an existing agent from your AI provider account.
          </p>
          <button
            onClick={onBack}
            className={`mt-8 ${btnPrimary}`}
          >
            Connect an Existing Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Connect view - real ProviderForm + RecentlyConnected ──────────────────

function ConnectView({
  providers,
  departments,
  initialAgents,
  onBack,
}: {
  providers:     Provider[];
  departments:   Department[];
  initialAgents: Agent[];
  onBack:        () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-5xl">
      <BackButton onClick={onBack} />
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Connect Your Provider</h2>
      <p className="text-sm text-gray-600 mb-8">
        Paste your org admin key to start seeing spending, trends, and cost recommendations across your agent fleet.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <ProviderForm
            providers={providers}
            departments={departments}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        </div>
        <div className="lg:col-span-2">
          <RecentlyConnected
            initialAgents={initialAgents}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}

// ── Progress breadcrumb ────────────────────────────────────────────────────

const STEPS: { id: View; label: string }[] = [
  { id: "choice",  label: "Get started"       },
  { id: "deploy",  label: "Deploy agent"      },
  { id: "connect", label: "Connect provider"  },
];

function StepBreadcrumb({ current }: { current: View }) {
  const activeIndex = STEPS.findIndex((s) => s.id === current);
  // Reduce to just [choice, current] for a two-step breadcrumb
  const visible = current === "choice"
    ? [STEPS[0]]
    : [STEPS[0], STEPS.find((s) => s.id === current)!];

  return (
    <nav aria-label="Onboarding progress" className="flex items-center gap-2 mb-6">
      {visible.map((step, i) => (
        <span key={step.id} className="flex items-center gap-2">
          {i > 0 && (
            <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          <span
            className={`text-sm font-medium ${
              step.id === current
                ? "text-[#00B2FF]"
                : "text-gray-400"
            }`}
            aria-current={step.id === current ? "step" : undefined}
          >
            {step.label}
          </span>
        </span>
      ))}
      <span className="ml-auto text-xs text-gray-400 hidden sm:block">
        Step {activeIndex + 1} of 2
      </span>
    </nav>
  );
}

// ── Page root ──────────────────────────────────────────────────────────────

export function OnboardClient({ providers, departments, initialAgents }: Props) {
  const [view, setView] = useState<View>("choice");

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Monitor Your Agent Fleet</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect your existing AI provider keys to see spending, trends, and savings recommendations.
        </p>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm p-8">
        <StepBreadcrumb current={view} />
        {view === "choice" && (
          <ChoiceView onSelect={(v) => setView(v)} />
        )}
        {view === "deploy" && (
          <DeployView onBack={() => setView("choice")} />
        )}
        {view === "connect" && (
          <ConnectView
            providers={providers}
            departments={departments}
            initialAgents={initialAgents}
            onBack={() => setView("choice")}
          />
        )}
      </div>
    </div>
  );
}

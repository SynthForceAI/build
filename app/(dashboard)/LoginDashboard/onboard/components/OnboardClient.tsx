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

        {/* Deploy card */}
        <button
          onClick={() => onSelect("deploy")}
          className="border border-gray-200 rounded-2xl p-8 hover:border-blue-300 hover:shadow-lg transition cursor-pointer flex flex-col h-full text-left"
        >
          <div className="text-[#00B2FF] mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">Deploy a New Agent</h3>
          <p className="text-sm text-gray-600 mb-5">
            Create a brand-new AI agent from scratch with department, budget, and guardrails.
          </p>
          <ul className="text-sm text-gray-500 list-disc pl-5 space-y-1 mb-6">
            <li>Full control over role and permissions</li>
            <li>Built-in cost tracking from day one</li>
            <li>Pre-configured guardrails</li>
          </ul>
          <span className={`mt-auto ${btnPrimary} text-center`}>Start Building</span>
        </button>

        {/* Connect card */}
        <button
          onClick={() => onSelect("connect")}
          className="border border-gray-200 rounded-2xl p-8 hover:border-purple-300 hover:shadow-lg transition cursor-pointer flex flex-col h-full text-left"
        >
          <div className="text-purple-600 mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">Connect an Existing Agent</h3>
          <p className="text-sm text-gray-600 mb-5">
            Already have agents running on OpenAI, Anthropic, or other platforms? Wrap them with SynthForce in minutes.
          </p>
          <ul className="text-sm text-gray-500 list-disc pl-5 space-y-1 mb-6">
            <li>Works with 10+ AI providers</li>
            <li>No code changes required</li>
            <li>Add oversight without disrupting workflows</li>
          </ul>
          <span className={`mt-auto ${btnPrimary} text-center`}>Connect Now</span>
        </button>
      </div>

      <p className="text-sm text-gray-500 text-center">
        Both options include full monitoring, cost tracking, policy enforcement, and offboarding workflows.
      </p>
    </div>
  );
}

// ── Deploy view — Coming Soon ──────────────────────────────────────────────

function DeployView({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-lg">
      <BackButton onClick={onBack} />
      <div className="bg-blue-50 rounded-2xl p-10 text-center">
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
          This feature launches in Phase 2 — September 2026.
        </p>
        <p className="text-sm text-gray-600">
          For now, connect an existing agent from your AI provider account.
        </p>
        <button
          onClick={onBack}
          className="mt-8 px-6 py-2.5 bg-[#00B2FF] text-white rounded-lg text-sm font-medium hover:bg-[#00B2FF]/90 transition"
        >
          Connect an Existing Agent
        </button>
      </div>
    </div>
  );
}

// ── Connect view — real ProviderForm + RecentlyConnected ──────────────────

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
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Connect an Existing Agent</h2>
      <p className="text-sm text-gray-600 mb-8">
        Already have agents running on OpenAI, Anthropic, or other platforms? Wrap them with SynthForce in minutes.
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

// ── Page root ──────────────────────────────────────────────────────────────

export function OnboardClient({ providers, departments, initialAgents }: Props) {
  const [view, setView] = useState<View>("choice");

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Onboard AI Agents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Choose how you&rsquo;d like to add an agent to your SynthForce dashboard.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
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

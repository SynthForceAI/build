"use client";

import { useState } from "react";
import Link from "next/link";
import { OriginalNavbar } from "@/components/ui/navbars";
import { WaitlistTrigger } from "@/components/ui/waitlist-trigger";

const TOC = [
  { id: "story", title: "The Story", subtitle: "Synthetic workforce, the cost of neglect" },
  { id: "the-shift", title: "The Shift", subtitle: "From infrastructure to workforce" },
  { id: "how-it-works", title: "How It Works", subtitle: "Onboard, measure, govern" },
  { id: "comparison", title: "The Comparison", subtitle: "HR for humans vs. HR for agents" },
  { id: "use-cases", title: "Who Needs This", subtitle: "Startups & enterprises" },
];

const HR_HUMANS = [
  { title: "Hiring", desc: "Defines roles, selects candidates, negotiates terms." },
  { title: "Onboarding", desc: "Sets expectations, provides tools, assigns a manager." },
  { title: "Performance", desc: "Tracks output, provides feedback, conducts reviews." },
  { title: "Compensation", desc: "Manages salary, bonuses, equity." },
  { title: "Policy", desc: "Enforces company rules, ensures compliance." },
  { title: "Offboarding", desc: "Revokes access, archives records, conducts exit." },
];

const HR_AGENTS = [
  { title: "Agent Creation", desc: "Templates for roles, predefined guardrails, no code." },
  { title: "Agent Onboarding", desc: "Assign a business owner, cost center, and workflows." },
  { title: "Agent Performance", desc: "Business-level metrics: tasks, cost per task, satisfaction." },
  { title: "Agent Compensation", desc: "API spend tracking, ROI calculations, budget optimization." },
  { title: "Agent Policy", desc: "Real-time guardrails, plain-English rules, violation logs." },
  { title: "Agent Offboarding", desc: "Archive logs, revoke permissions, generate audit trails." },
];

export default function ProductPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 w-full z-50 border-b border-subtle bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <img
                src="/assets/logo_top_corner.png"
                className="h-8 max-h-8 w-auto object-contain"
                alt="SynthForce Logo"
              />
            </Link>
          </div>
          <OriginalNavbar />
          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="md:hidden text-gray-700"
            aria-label="Toggle menu"
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
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-subtle px-6 py-4">
            <div className="flex flex-col gap-4 text-sm font-sans text-gray-600">
              <Link href="/" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Home</Link>
              <Link href="/product" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Product</Link>
              <Link href="/demo" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Demo</Link>
              <Link href="/blog" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
              <Link href="/about" className="py-2 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>About</Link>
              <WaitlistTrigger
                className="py-2 text-gray-900 font-medium cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}
              >
                Waitlist →
              </WaitlistTrigger>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-12 pb-20 container mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-12">
          <aside className="lg:w-1/4">
            <div className="sticky top-24 p-6 border border-subtle rounded-2xl bg-gray-50">
              <h3 className="font-sans font-bold text-gray-900 text-xl mb-4">In This Page</h3>
              <div className="space-y-2">
                {TOC.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block px-4 py-3 rounded-lg hover:bg-gray-100 border-l-[3px] border-transparent hover:border-[#00B2FF]"
                  >
                    <span className="font-sans font-medium text-gray-900">{item.title}</span>
                    <span className="text-xs text-gray-500 block">{item.subtitle}</span>
                  </a>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-subtle">
                <p className="text-sm text-gray-600">
                  SynthForce is the HR platform for AI agents. Manage your synthetic workforce with
                  the same rigor as your human team.
                </p>
              </div>
            </div>
          </aside>

          <div className="lg:w-3/4">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-16">
                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                  The only HR platform built for AI agents.
                </h1>
                <p className="text-xl text-gray-600">
                  Onboard, measure, and govern your synthetic workforce &mdash; without code or jargon.
                </p>
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <Link
                    href="/demo"
                    className="px-8 py-4 font-sans font-semibold text-sm uppercase rounded-lg bg-[#00B2FF] text-white border border-[#00B2FF] hover:bg-transparent hover:text-[#00B2FF] transition"
                  >
                    View Demo
                  </Link>
                  <WaitlistTrigger className="px-8 py-4 font-sans font-semibold text-sm uppercase border border-subtle rounded-lg hover:border-gray-900 transition cursor-pointer">
                    Join Waitlist
                  </WaitlistTrigger>
                </div>
              </div>

              <section id="story" className="mb-20 scroll-mt-24">
                <div className="mb-16">
                  <h2 className="text-4xl font-bold text-gray-900 mb-8">
                    The Synthetic Workforce Is Here
                  </h2>
                  <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                    Your company is no longer just humans. It&rsquo;s hybrid.
                  </p>
                  <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                    You have a sales team, a support team, a dev team. And now you have a sales bot,
                    a support bot, a coding bot. They are not tools. They are synthetic employees.
                  </p>
                  <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                    In 2025, you had five agents. You could read their logs. In 2026, you have fifty.
                    You cannot. In 2027, you will have five hundred. You will not even know their
                    names.
                  </p>
                </div>

                <div className="border-l-4 border-[#00B2FF] pl-6 mb-16">
                  <p className="text-xl text-gray-900 font-semibold mb-4">
                    The companies that survive the agent explosion will be the ones that manage
                    their synthetic workforce with the same rigor as their human one.
                  </p>
                  <p className="text-gray-600">Everyone else faces three consequences.</p>
                </div>

                <div className="space-y-8 mb-16">
                  <ConsequenceCard
                    title="Financial Bleed"
                    body="An agent loops, burns $10k in API credits overnight. Nobody notices until the bill arrives. Companies with 50+ agents report an average of 15% API spend waste from runaway agents, undetected errors, and zombie processes that serve no purpose."
                    footer="The teams that track per-agent costs cut waste by 40% in six months."
                  />
                  <ConsequenceCard
                    title="Silent Liability"
                    body="A support bot promises a refund it cannot deliver. A sales bot quotes a price that violates policy. A coding agent pushes code with a security flaw. No guardrails caught it. Legal and compliance are blindsided."
                    footer="Without policy enforcement, every agent is a potential lawsuit waiting to happen."
                  />
                  <ConsequenceCard
                    title="Manager Blindness"
                    body={
                      <>
                        Today, agents are managed by SWEs. The &ldquo;manager&rdquo; of your sales
                        bot is a software developer who speaks in tokens and embeddings, not in
                        leads and conversions. A sales bot should be managed by the Sales Manager. A
                        support bot by the Support Lead. A coding bot by the Dev Manager.
                      </>
                    }
                    footer="You cannot scale a synthetic workforce if only engineers can read the dashboards."
                  />
                </div>
              </section>

              <section id="the-shift" className="mb-20 scroll-mt-24">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    The Shift: From Infrastructure to Workforce
                  </h2>
                  <p className="text-lg text-gray-700 mb-6 leading-relaxed max-w-2xl mx-auto">
                    Most tools today treat agents as infrastructure. They monitor uptime, latency,
                    tokens. That is like measuring a human employee by their heartbeat and calorie
                    intake. Necessary, but not sufficient.
                  </p>
                  <p className="text-lg text-gray-700 leading-relaxed max-w-2xl mx-auto">
                    SynthForce treats agents as <strong>employees</strong>. We measure their output,
                    their value, their adherence to policy. We give managers the language and tools
                    to manage agents like they manage their human team.
                  </p>
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <p className="font-semibold text-gray-900 text-lg">
                      If you can manage employees, you can manage agents.
                    </p>
                  </div>
                </div>
              </section>

              <section id="how-it-works" className="mb-20 scroll-mt-24">
                <h2 className="text-4xl font-bold text-gray-900 mb-10 text-center">
                  How SynthForce Works
                </h2>
                <div className="space-y-8">
                  <HowStep
                    title="Onboard"
                    body="Create new agents from templates or connect existing ones. Assign a business owner, department, and budget. Your Sales Manager does not need to know what an API key is."
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    }
                  />
                  <HowStep
                    title="Measure"
                    body="Track performance, cost, and compliance in real-time. Dashboards show business-level metrics: tasks completed, cost per task, error rate, ROI. In plain English, not token counts."
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    }
                  />
                  <HowStep
                    title="Govern"
                    body="Enforce guardrails, set policies, and automate offboarding. Prevent unauthorized promises, PII leaks, and budget overruns before they happen. Policies are written in plain English, not code."
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    }
                  />
                </div>
              </section>

              <section id="comparison" className="mb-20 scroll-mt-24">
                <h2 className="text-4xl font-bold text-gray-900 mb-10 text-center">
                  The Same Rigor, Applied Differently
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <ComparisonColumn heading="What HR Does for Humans" items={HR_HUMANS} />
                  <ComparisonColumn heading="What SynthForce Does for Agents" items={HR_AGENTS} />
                </div>
              </section>

              <section id="use-cases" className="mb-20 scroll-mt-24">
                <h2 className="text-4xl font-bold text-gray-900 mb-10 text-center">Who Needs This</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <UseCaseCard
                    title="AI-First Startups"
                    body="You have built multiple agents for sales, support, and product. Now you need to track cost, enforce guardrails, and give your non-technical founders visibility."
                    bullets={[
                      "Track ROI per agent",
                      "Prevent budget overruns",
                      "Share dashboards with investors",
                    ]}
                  />
                  <UseCaseCard
                    title="Enterprise AI Teams"
                    body="Your company uses AI across departments. You need centralized management, compliance reporting, and charge-back to business units."
                    bullets={[
                      "Enforce company-wide AI policies",
                      "Audit trails for regulators",
                      "Showback and charge-back by department",
                    ]}
                  />
                </div>
              </section>

              <div className="text-center border-t border-subtle pt-16">
                <h2 className="text-4xl font-bold text-gray-900 mb-6">
                  Ready to Manage Your Synthetic Workforce?
                </h2>
                <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
                  Join the waitlist for early access. Pilot customers get 3 months free and a
                  dedicated onboarding call.
                </p>
                <WaitlistTrigger className="inline-block px-10 py-5 font-sans font-semibold text-sm uppercase rounded-lg bg-[#00B2FF] text-white border border-[#00B2FF] hover:bg-transparent hover:text-[#00B2FF] transition cursor-pointer">
                  Join Waitlist - Early Access
                </WaitlistTrigger>
                <p className="mt-6 text-gray-500">
                  Or{" "}
                  <Link href="/demo" className="text-[#00B2FF] hover:underline">
                    explore the demo
                  </Link>{" "}
                  to see SynthForce in action.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function ConsequenceCard({
  title,
  body,
  footer,
}: {
  title: string;
  body: React.ReactNode;
  footer: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 hover:border-red-200 transition">
      <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-lg text-gray-700 leading-relaxed">{body}</p>
      <p className="text-gray-500 mt-3 text-sm">{footer}</p>
    </div>
  );
}

function HowStep({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm hover:shadow-lg transition">
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 w-16 h-16 bg-[#00B2FF]/10 rounded-2xl flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[#00B2FF]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {icon}
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-lg text-gray-700">{body}</p>
        </div>
      </div>
    </div>
  );
}

function ComparisonColumn({
  heading,
  items,
}: {
  heading: string;
  items: { title: string; desc: string }[];
}) {
  return (
    <div>
      <h3 className="text-2xl font-bold text-gray-700 mb-6">{heading}</h3>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={item.title} className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-[#00B2FF]/10 rounded-full flex items-center justify-center text-sm font-bold text-[#00B2FF] mr-4">
              {i + 1}
            </div>
            <div>
              <strong className="block text-gray-900">{item.title}</strong>
              <span className="text-gray-600"> {item.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UseCaseCard({
  title,
  body,
  bullets,
}: {
  title: string;
  body: string;
  bullets: string[];
}) {
  return (
    <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">{title}</h3>
      <p className="text-xl text-gray-700 mb-6">{body}</p>
      <ul className="text-gray-600 space-y-2 text-lg">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

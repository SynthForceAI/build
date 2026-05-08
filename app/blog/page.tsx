'use client';

import Link from 'next/link';
import { useState } from 'react';
import { OriginalNavbar } from "@/components/ui/navbars";

const articleStyles = `
  .article-content h2 { font-size: 1.75rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 1rem; color: #111827; }
  .article-content h3 { font-size: 1.375rem; font-weight: 600; margin-top: 1.75rem; margin-bottom: 0.75rem; color: #1f2937; }
  .article-content p { font-size: 1.125rem; line-height: 1.8; margin-bottom: 1.25rem; color: #374151; }
  .article-content ul, .article-content ol { font-size: 1.125rem; line-height: 1.8; margin-bottom: 1.25rem; color: #374151; padding-left: 1.5rem; }
  .article-content li { margin-bottom: 0.5rem; }
  .article-content blockquote { border-left: 4px solid #00B2FF; padding-left: 1.5rem; margin: 1.5rem 0; font-style: italic; color: #4b5563; }
  .article-content .stat-box { background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; }
  .article-content .stat-box .stat { font-size: 2.25rem; font-weight: 700; color: #00B2FF; display: block; }
  .article-content .stat-box .stat-label { font-size: 1rem; color: #6b7280; display: block; margin-top: 0.25rem; }
  .article-content a { color: #00B2FF; text-decoration: underline; }
  .btn-primary { background: #00B2FF; color: #fff; border: 1px solid #00B2FF; transition: all 0.2s ease; border-radius: 8px; }
  .btn-primary:hover { background: transparent; color: #00B2FF; }
`;

export default function BlogPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="bg-paper text-void font-sans">
      <style dangerouslySetInnerHTML={{ __html: articleStyles }} />

      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-subtle">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/assets/logo_top_corner.png"
              className="h-7 max-h-7 w-auto object-contain"
              alt="SynthForce"
            />
          </Link>
          <OriginalNavbar/>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            className="md:hidden p-2 text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <div id="mobile-menu" className={`${mobileOpen ? '' : 'hidden'} md:hidden border-t border-subtle bg-white`}>
          <div className="px-6 py-4 space-y-3">
            <Link href="/product" onClick={closeMobile} className="block py-2 text-gray-900 font-medium">Product</Link>
            <Link href="/demo" onClick={closeMobile} className="block py-2 text-gray-900 font-medium">Demo</Link>
            <Link href="/blog" onClick={closeMobile} className="block py-2 text-gray-900 font-medium">Blog</Link>
            <Link href="/about" onClick={closeMobile} className="block py-2 text-gray-900 font-medium">About</Link>
            <Link href="/waitlistsignup" onClick={closeMobile} className="block py-2 text-gray-900 font-medium">Waitlist</Link>
          </div>
        </div>
      </nav>

      <main className="pb-20">
        <div className="bg-gray-50 border-b border-subtle py-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-6">Blog</p>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Insights on Managing Your Synthetic Workforce
            </h1>
            <p className="text-xl text-gray-600">
              Thoughts on AI agent operations, cost optimization, policy enforcement, and building the HR layer for AI.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">Latest Post</h2>
          <div className="bg-white border border-gray-200 rounded-2xl p-10 hover:shadow-lg transition">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs uppercase tracking-wider text-green-600 font-semibold bg-green-50 px-3 py-1 rounded-full">
                Published April 26, 2026
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              <a href="#article" className="hover:text-accent transition">
                The Agent Explosion: How to Prepare for 500 AI Agents
              </a>
            </h3>
            <p className="text-lg text-gray-600 mb-6">
              You have 5 agents today. By next year you will have 50. By 2028 you will have 500.
              Based on research from Gartner, G2, Deloitte, McKinsey, and Stanford: what breaks at each stage and how to prepare.
            </p>
            <div className="flex items-center gap-4">
              <a href="#article" className="text-accent hover:underline font-medium">
                Read the full post &rarr;
              </a>
              <span className="text-gray-400">|</span>
              <span className="text-sm text-gray-500">22 min read &middot; 7 sources cited</span>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-10 mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">Upcoming Topics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Coming Soon</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">The Cost of Runaway Agents</h3>
              <p className="text-gray-600">
                An analysis of real-world AI agent cost overruns, why they happen, and how to prevent them.
                Why companies with 50+ agents see 15%+ API spend waste from runaway loops and zombie processes.
              </p>
            </div>
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Coming Soon</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Why You Need an Org Chart for Your AI Agents</h3>
              <p className="text-gray-600">
                A framework for assigning business owners, departments, and roles to synthetic employees.
                Move beyond SLAs to actual management.
              </p>
            </div>
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Coming Soon</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Policies Every AI Agent Needs</h3>
              <p className="text-gray-600">
                From no-PII rules to refund guardrails: the policies that prevent silent liability.
                A checklist for anyone deploying AI agents in customer-facing roles.
              </p>
            </div>
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Coming Soon</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">AI Agent ROI: A Calculator Framework</h3>
              <p className="text-gray-600">
                How to measure whether your sales bot, support bot, or coding bot is actually worth what it costs.
                A practical framework for non-technical managers.
              </p>
            </div>
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition bg-gray-50 border-dashed">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Future</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">More to come...</h3>
              <p className="text-gray-600">
                We are building the knowledge base for the age of synthetic work. Subscribe to follow along.
              </p>
            </div>
          </div>
        </div>

        <article id="article" className="max-w-3xl mx-auto px-6 scroll-mt-20">
          <div className="pt-10 pb-6">
            <Link href="/blog" className="text-accent hover:underline text-sm">
              &larr; Back to Blog
            </Link>
          </div>

          <div className="mb-10">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-4">
              First Post &middot; April 26, 2026
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              The Agent Explosion: How to Prepare for 500 AI Agents
            </h1>
            <p className="text-xl text-gray-600">
              You have 5 agents today. By next year you will have 50. By 2028 you will have 500.
              Here is what breaks at each stage and how to prepare.
            </p>
          </div>

          <div className="flex items-center gap-4 pb-10 border-b border-subtle mb-10">
            <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
              <span className="text-accent font-bold text-xl">S</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Samarth Kambli</p>
              <p className="text-sm text-gray-500">Founder, SynthForce</p>
            </div>
          </div>

          <div className="article-content">
            <p>The AI agent explosion is not coming. It is here.</p>

            <p>
              In 2025, you had 5 agents. A chatbot on your website, a sales sequencing bot, a code review bot,
              a customer support triage agent, maybe a content generator. They were manageable. You could track them in a spreadsheet.
            </p>

            <p>
              In 2026, you have 50. Every department has deployed one. Sales has three. Support has five.
              Engineering has ten. Marketing has two. You have no idea how much each one costs.
            </p>

            <p>
              By 2028, you will have 500. Autonomous agents will handle procurement, hiring, compliance monitoring,
              and vendor management. They will negotiate with each other. They will create contracts. They will hire and fire other agents.
            </p>

            <p>If you do not build the infrastructure to manage them now, they will manage you.</p>

            <h2>The Numbers Are Real</h2>

            <p>AI agents are the fastest adopted technology in enterprise history. Here are the numbers:</p>

            <div className="stat-box">
              <span className="stat">57%</span>
              <span className="stat-label">
                of companies already have AI agents in production. Source: G2 Enterprise AI Agents Report,
                August 2025 survey of 1,000+ B2B decision makers
              </span>
            </div>

            <p>
              G2 found that 57% of organizations surveyed have agents running in production today. Another 22% are in pilot.
              Only 21% are in pre-pilot. The cycle from experimentation to deployment is measured in months, not years.
            </p>

            <div className="stat-box">
              <span className="stat">40%</span>
              <span className="stat-label">
                of enterprise applications will embed task specific AI agents by end of 2026. Source: Gartner, August 2025
              </span>
            </div>

            <p>
              Gartner predicts that 40% of enterprise applications will feature integrated, task specific AI agents by the end of this year.
              That is up from less than 5% in 2025. An 8x increase in two years.
            </p>

            <div className="stat-box">
              <span className="stat">$7.6B</span>
              <span className="stat-label">
                global AI agents market in 2025, projected to reach $93B by 2032. Source: Grand View Research, Azumo, Salesmate
              </span>
            </div>

            <p>
              Grand View Research pegs the global AI agents market at $7.63 billion in 2025, growing at a CAGR of 49.6%
              to $182.97 billion by 2033. Other analyses from Azumo and Salesmate converge on similar trajectories of 44 to 46% CAGR through 2032.
            </p>

            <div className="stat-box">
              <span className="stat">50%</span>
              <span className="stat-label">
                increase in workforce access to AI tools year over year. Source: Deloitte State of AI in the Enterprise Report, 2026
              </span>
            </div>

            <p>
              Deloitte found that U.S. companies have expanded workforce access to AI from fewer than 40% of workers to approximately 60% in just one year.
              The number of companies with 40% or more of their AI projects in production is set to double in six months.
            </p>

            <div className="stat-box">
              <span className="stat">$1M+</span>
              <span className="stat-label">
                AI agent budget for 40% of companies this year. Source: G2 Enterprise AI Agents Report
              </span>
            </div>

            <p>
              Forty percent of organizations surveyed by G2 have an AI agent budget exceeding $1 million in 2026.
              One in four large enterprises is planning to spend $5 million or more.
              The average projected AI budget across organizations is $207 million for the next 12 months, nearly double the figure from last year.
            </p>

            <h2>What Breaks at 5 Agents</h2>

            <p>
              At 5 agents, nothing breaks. You know what each one does. You check logs manually. Your developer built them, deploys them, fixes them.
              Cost is a rounding error on the AWS bill. This is the honeymoon phase.
            </p>

            <p>
              <strong>The danger here is complacency.</strong> You do not need documentation. You do not need dashboards.
              You do not need policies. This feels sustainable. It is not.
            </p>

            <h2>What Breaks at 50 Agents</h2>

            <p>This is where the cracks appear. Here is what happens:</p>

            <p>
              <strong>Cost becomes invisible.</strong> You receive the API bill and cannot explain which agent consumed what.
              Was it the sales bot that looped for 12 hours generating 300,000 tokens of garbage?
              Or was it the new content agent marketing deployed without telling anyone? You do not know.
              A 2026 CIO article describes the problem bluntly: AI native spending nearly doubled in 2025,
              and hybrid pricing models from providers drive surprise charges from token overages, tier shifts, and mid contract upgrades.
              Shadow AI (agents deployed without central approval) expands spend and risk.
            </p>

            <p>
              <strong>Managers go blind.</strong> The sales bot is managed by software engineers. They report latency, token counts, uptime.
              The sales manager needs to know leads generated, conversion rate, cost per qualified lead. The two languages do not translate.
            </p>

            <p>
              <strong>Policy is aspirational.</strong> You have no guardrails. An agent makes an unauthorized promise.
              A refund the company cannot honor. A price that violates policy. Legal discovers it a week later.
              A survey cited by Microsoft&apos;s Agent Governance Toolkit found that 82% of enterprise leaders express
              confidence that their existing policies protect against unauthorized agent actions, but only 14.4% of organizations
              actually deploy agents with formal security or IT approval. Confidence is not control.
            </p>

            <p>
              <strong>90% of companies stop here.</strong> McKinsey&apos;s 2025 global survey found that 88% of enterprises have experimented with AI,
              but fewer than 10% have scaled agentic AI to deliver measurable value. G2&apos;s report points to the same reality:
              fewer than 10% of companies successfully scale beyond single agent deployments.
              The rest hit walls around coordination, visibility, and governance.
            </p>

            <h2>What Breaks at 500 Agents</h2>

            <p>
              If you reach 500 agents, you have solved engineering scale. Now you face organizational scale.
              Entirely new failure modes emerge:
            </p>

            <p>
              <strong>Agent agent interactions cascade.</strong> A procurement agent negotiates with a vendor agent.
              A compliance agent flags a conflict. A hiring agent creates a contract. Each interaction is logged in a different system.
              When something goes wrong, tracing it requires three teams and four tools.
            </p>

            <p>
              <strong>Orphan agents accumulate.</strong> An agent built for a Q3 campaign runs silently for six months after the campaign ends.
              No one remembers it exists. It still costs API credits. It still interacts with customers. It operates with outdated policies.
              It is a zombie: undead, unbillable, unmanaged.
            </p>

            <p>
              <strong>Compliance becomes impossible without automation.</strong> The Colorado AI Act takes effect June 2026.
              The EU AI Act high risk obligations take effect August 2026. ISO/IEC 42001, the first international standard for AI management systems,
              provides a certifiable governance framework. Ad hoc compliance reporting does not work when you have hundreds of agents
              running across departments, each with different providers, different data access, and different risk profiles.
            </p>

            <p>
              <strong>The 89% problem compounds.</strong> Stanford&apos;s 2026 AI Index Report found that 89% of enterprise AI agents never reach production.
              That means zero return on investments that range from $150,000 to $800,000 per implementation.
              At 500 agents, that failure rate represents tens of millions in sunk cost. The agents that do reach production succeed at 66% of tasks,
              within striking distance of human performance at 72%. But the pipeline leaks.
            </p>

            <h2>Seven Things You Can Do Today</h2>

            <p>
              You do not need a massive reorganization. You need to start building muscle before the explosion hits.
              Here is a practical checklist:
            </p>

            <ol>
              <li>
                <strong>Assign an owner to every agent.</strong> Every agent should have a named business owner,
                not just a developer who built it. The owner sets goals, reviews performance, and decides whether the agent stays or goes.
              </li>
              <li>
                <strong>Track cost per agent, not total API spend.</strong> You cannot optimize what you cannot attribute.
                Start tagging API calls by agent. Know what each one costs. A 15% waste reduction alone often justifies the overhead.
              </li>
              <li>
                <strong>Write plain English policies.</strong> &quot;This agent cannot authorize refunds over $50.&quot;
                &quot;This agent cannot access customer PII.&quot; These are not engineering requirements.
                They are management requirements. Write them down. Enforce them. Audit them.
              </li>
              <li>
                <strong>Designate a department for every agent.</strong> A sales bot belongs to Sales. A support bot belongs to Support.
                Give the department head a dashboard they can read without a software engineering degree.
              </li>
              <li>
                <strong>Build a playbook for agent offboarding.</strong> When an agent is no longer needed, who revokes its API keys?
                Who archives its logs? Who notifies customers that relied on it? Without an offboarding process, every agent you ever build lives forever.
              </li>
              <li>
                <strong>Measure business outcomes, not technical metrics.</strong> Latency and uptime are infrastructure metrics.
                Leads generated, cost per task, error rate, customer satisfaction. These are management metrics.
                Start collecting both. Report the latter to the business owner.
              </li>
              <li>
                <strong>Plan for 500.</strong> The framework you build for 5 agents should work at 500.
                If you are using spreadsheets and Slack channels to manage agents today, design the system that replaces them before it becomes an emergency.
              </li>
            </ol>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 my-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Bottom Line</h3>
              <p className="text-lg text-gray-700">
                The agent explosion is not hypothetical. Gartner says 40% of enterprise applications will have agents by December.
                G2 says 57% of companies are already in production. Deloitte says workforce AI access grew 50% in one year.
                McKinsey says fewer than 10% of companies are ready to scale.
              </p>
              <p className="text-lg text-gray-700 mt-4">
                The gap between adoption and management is the opportunity. Companies that close it first will win their markets.
                Companies that ignore it will watch their agent bills climb, their liability accumulate, and their competitors pull ahead.
              </p>
              <p className="text-lg text-gray-700 mt-4">
                Start preparing today. Not when you hit 50 agents. Not when you hit 500. Now.
              </p>
            </div>

            <p className="text-gray-500 text-sm italic mt-8">
              Sources: G2 Enterprise AI Agents Report (August 2025), Gartner (August 2025),
              Deloitte State of AI in the Enterprise Report (2026), McKinsey State of AI 2025,
              Grand View Research AI Agents Market Report (2025), Stanford HAI AI Index Report (2026),
              Microsoft Agent Governance Toolkit (2026), Forbes, CIO, ZDNet.
            </p>
          </div>

          <div className="border-t border-subtle pt-10 mt-10">
            <div className="bg-gray-50 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                SynthForce is the HR platform for AI agents.
              </h3>
              <p className="text-gray-600 mb-6">
                Onboard, measure, and govern your synthetic workforce. Join the waitlist for early access.
              </p>
              <Link
                href="/waitlistsignup"
                className="btn-primary px-8 py-4 font-sans font-semibold text-sm uppercase rounded-lg inline-block"
              >
                Join Waitlist
              </Link>
              <p className="mt-4 text-sm text-gray-500">
                Or <Link href="/demo" className="text-accent hover:underline">see the demo</Link>.
              </p>
            </div>
          </div>
        </article>
      </main>

    </div>
  );
}

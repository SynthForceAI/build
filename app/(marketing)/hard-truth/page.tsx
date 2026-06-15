'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { SiteNav } from '@/components/ui/site-nav';

const EASE = [0.22, 1, 0.36, 1] as const;

function FadeUp({ children, delay = 0, className = '' }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

type Fact = {
  stat:    string;
  claim:   string;
  context: string;
  source:  string;
  accent:  'red' | 'orange' | 'blue' | 'gray' | 'green';
};

const FACTS: Fact[] = [
  {
    stat:    '$47,000',
    claim:   'Lost in 11 days. No one noticed until the invoice arrived.',
    context: 'Four LangChain agents in an A2A coordination loop ran undetected for 264 hours. Cost compounded from $127 in week one to $18,400 in week four — discovered only at billing.',
    source:  'Post-mortem by Teja Kusireddy · TechStartups.com, Nov 14 2025 · HN #45802430',
    accent:  'red',
  },
  {
    stat:    '4 months',
    claim:   "Uber burned its entire 2026 AI coding budget before Q2.",
    context: 'Spend was capped at $1,500/month per tool after the blowout. COO Andrew Macdonald: "The link between token spend and output is not there yet."',
    source:  'Uber internal report, 2026',
    accent:  'orange',
  },
  {
    stat:    '26%',
    claim:   'Only one in four companies can actually see their AI costs.',
    context: 'The other 74% are flying blind — approving budgets, shipping agents, and signing off on invoices with no real visibility into where the money goes.',
    source:  'KPMG enterprise AI survey',
    accent:  'red',
  },
  {
    stat:    '24×',
    claim:   'Enterprise token consumption will increase 24-fold by 2030.',
    context: 'Today\'s spending problem compounds every year. Every blind spot you have now will cost proportionally more as your fleet scales.',
    source:  'Goldman Sachs AI infrastructure forecast',
    accent:  'orange',
  },
  {
    stat:    '96%',
    claim:   'AI agents are 96% cheaper per task than human workers.',
    context: 'Human workers average $24.79 per task. AI agents powered by GPT-4o and Claude Sonnet average $0.94 and $2.39 — a 96.2% and 90.4% cost reduction. The agents are not a bet on the future. They are already cheaper.',
    source:  'Stanford/CMU · "How Do AI Agents Do Human Work?" · arXiv:2510.22780',
    accent:  'green',
  },
  {
    stat:    '200%',
    claim:   'Replacing one human costs up to 200% of their annual salary.',
    context: 'Your agents already do the equivalent of several FTEs. Gallup estimates replacement costs at 200% for managers, 80% for technical roles, 40% for frontline. You are managing a payroll — you just cannot see it yet.',
    source:  'SHRM / Gallup workforce studies',
    accent:  'blue',
  },
  {
    stat:    '59%',
    claim:   'One engineering team cut their LLM costs by 59% without changing their models.',
    context: 'ProjectDiscovery moved dynamic content out of the cached prefix. Cache hit rate went from 7% to 74%. No model swap. No code rewrite. Just knowing where the waste was.',
    source:  'ProjectDiscovery engineering blog · 2025',
    accent:  'green',
  },
  {
    stat:    '97%',
    claim:   'Mini models cost 97% less — and agree with flagship models 90% of the time.',
    context: 'Most high-volume, simple workloads do not need GPT-4-class reasoning. The agents running them are overqualified. You are paying executive salaries for filing-cabinet work.',
    source:  'Cross-provider model benchmarks · 2025',
    accent:  'blue',
  },
  {
    stat:    '0%',
    claim:   'Billing data can show you the spike. It cannot tell you who caused it.',
    context: 'Every AI provider will tell you how much you spent. None will tell you which agent, task, or customer triggered a five-figure overage. That attribution gap is where the damage happens — and where SynthForce operates.',
    source:  'OpenAI / Anthropic Usage API documentation',
    accent:  'gray',
  },
];

const accentStyles: Record<Fact['accent'], { border: string; stat: string; dot: string }> = {
  red:    { border: 'border-red-200',    stat: 'text-red-600',    dot: 'bg-red-500'    },
  orange: { border: 'border-orange-200', stat: 'text-orange-600', dot: 'bg-orange-500' },
  blue:   { border: 'border-blue-200',   stat: 'text-blue-600',   dot: 'bg-[#00B2FF]'  },
  green:  { border: 'border-green-200',  stat: 'text-green-600',  dot: 'bg-green-500'  },
  gray:   { border: 'border-gray-300',   stat: 'text-gray-900',   dot: 'bg-gray-500'   },
};

export default function HardTruthPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <SiteNav position="fixed" />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="pt-40 pb-20 px-6 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111 60%, #fff 100%)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 text-xs font-semibold text-red-400 mb-8 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            Verified data · no spin
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 text-white leading-tight tracking-tight">
            The Hard Truth
          </h1>
          <p className="text-xl sm:text-2xl text-gray-400 mb-4 font-medium max-w-2xl mx-auto">
            Nine facts about AI agent costs that your provider will never put in a dashboard.
          </p>
          <p className="text-sm text-gray-600 max-w-xl mx-auto">
            Every number below is sourced. Every incident is documented. This is the reality companies are navigating — mostly without the tools to see it.
          </p>
        </motion.div>
      </section>

      {/* ── Facts grid ───────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FACTS.map((fact, i) => {
            const styles = accentStyles[fact.accent];
            return (
              <FadeUp key={fact.stat + i} delay={i * 0.05}>
                <div className={`bg-white border ${styles.border} rounded-2xl p-8 h-full flex flex-col shadow-sm hover:shadow-md transition-shadow`}>
                  {/* Stat */}
                  <div className={`text-5xl font-bold mb-3 ${styles.stat} leading-none tracking-tight`}>
                    {fact.stat}
                  </div>

                  {/* Claim */}
                  <h3 className="text-base font-semibold text-gray-900 mb-3 leading-snug">
                    {fact.claim}
                  </h3>

                  {/* Context */}
                  <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-5">
                    {fact.context}
                  </p>

                  {/* Source */}
                  <div className="flex items-start gap-2 pt-4 border-t border-gray-100">
                    <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
                    <p className="text-xs text-gray-400 leading-relaxed">{fact.source}</p>
                  </div>
                </div>
              </FadeUp>
            );
          })}
        </div>

        {/* Last fact (attribution gap) spans full width */}
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────── */}
      <section className="bg-gray-950 py-24 px-6">
        <FadeUp className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            You already have the agents.<br />
            <span className="text-[#00B2FF]">Now get the visibility.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
            Connect your OpenAI or Anthropic admin key and get a free audit in under 60 seconds. No code. No card.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-9 py-4 font-semibold text-sm uppercase rounded-lg bg-[#00B2FF] text-white hover:bg-[#00B2FF]/90 transition"
            >
              Run a free audit →
            </Link>
            <Link
              href="/demo"
              className="px-9 py-4 font-semibold text-sm uppercase rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition"
            >
              See the demo
            </Link>
          </div>
        </FadeUp>
      </section>
    </div>
  );
}

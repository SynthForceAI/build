'use client';

import Link from 'next/link';
import { useState, useEffect, type CSSProperties } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { WaitlistTrigger } from "@/components/ui/waitlist-trigger";

// ── CSS ────────────────────────────────────────────────────────────────────

const pageStyles = `
  .hero-title { letter-spacing: -0.02em; line-height: 1.1; }
  .btn-primary { background: #00B2FF; color: #fff; border: 1px solid #00B2FF; transition: all 0.2s ease; border-radius: 8px; }
  .btn-primary:hover { background: transparent; color: #00B2FF; }
  .integration-card { background: white; border: 1px solid #e5e5e5; border-radius: 1rem; padding: 1.5rem; text-align: center; transition: all 0.3s ease; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  .integration-card:hover { transform: translateY(-4px); box-shadow: 0 12px 20px -4px rgba(0,0,0,0.1); border-color: transparent; }
  .dark .integration-card { background: rgb(30 41 59); border-color: rgb(51 65 85); }
  .scene { transition: transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease; }
`;

// ── Framer Motion variants ─────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const headlineContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } },
};
const wordVariant = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};
const staggerGrid = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const fadeSlideUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

// ── Reusable scroll-reveal wrapper ─────────────────────────────────────────

function FadeUp({ children, delay = 0, className = "" }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function FadeIn({ children, delay = 0, className = "" }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

// ── Animated background blob ───────────────────────────────────────────────

function Blob({ className, duration = 10, dx = 30, dy = 20, delay = 0 }: {
  className: string;
  duration?: number;
  dx?: number;
  dy?: number;
  delay?: number;
}) {
  return (
    <motion.div
      aria-hidden
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{
        scale:  [1,    1.22,        0.92,       1.18,       0.97, 1],
        x:      [0,    dx,          dx * 0.25,  -dx * 0.4,  dx * 0.1, 0],
        y:      [0,    dy * 0.4,    dy,         dy * 0.15,  -dy * 0.3, 0],
        rotate: [0,    18,          -12,        22,         -6,  0],
      }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

// ── Mouse-following hero glow ──────────────────────────────────────────────

function HeroGlow() {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  // Three blobs at different spring speeds - slowest feels furthest away
  const slowX  = useSpring(rawX, { stiffness: 28, damping: 28 });
  const slowY  = useSpring(rawY, { stiffness: 28, damping: 28 });
  const midX   = useSpring(rawX, { stiffness: 50, damping: 22 });
  const midY   = useSpring(rawY, { stiffness: 50, damping: 22 });
  const fastX  = useSpring(rawX, { stiffness: 80, damping: 18 });
  const fastY  = useSpring(rawY, { stiffness: 80, damping: 18 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      rawX.set((e.clientX - window.innerWidth  / 2) * 0.10);
      rawY.set((e.clientY - window.innerHeight / 2) * 0.10);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [rawX, rawY]);

  return (
    <>
      {/* Large slow blob - base ambient glow */}
      <motion.div aria-hidden
        className="absolute rounded-full blur-3xl pointer-events-none w-[700px] h-[700px] bg-[#00B2FF]/[0.08] -top-32 left-1/2 -translate-x-1/2"
        style={{ x: slowX, y: slowY }}
      />
      {/* Mid blob - follows a bit faster, sits left */}
      <motion.div aria-hidden
        className="absolute rounded-full blur-3xl pointer-events-none w-[450px] h-[450px] bg-[#00B2FF]/[0.06] top-10 left-[10%]"
        style={{ x: midX, y: midY }}
      />
      {/* Small fast blob - snappiest, sits right, creates highlight near cursor */}
      <motion.div aria-hidden
        className="absolute rounded-full blur-2xl pointer-events-none w-[280px] h-[280px] bg-[#00B2FF]/[0.07] top-[20%] right-[12%]"
        style={{ x: fastX, y: fastY }}
      />
    </>
  );
}

// ── Carousel constants ─────────────────────────────────────────────────────

const SCENE_COUNT = 4;

// ── Page ───────────────────────────────────────────────────────────────────

export default function Home() {
  const [current, setCurrent] = useState(0);

  const sceneStyle = (index: number): CSSProperties => {
    const isActive = index === current;
    return {
      position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '1.5rem',
      transform: isActive ? 'translateX(0)' : index < current ? 'translateX(-100%)' : 'translateX(100%)',
      opacity: isActive ? 1 : 0,
      zIndex: isActive ? 10 : 1,
    };
  };

  const headlineWords = "Manage your AI agents like employees.".split(" ");

  return (
    <div className="min-h-screen flex flex-col relative bg-white dark:bg-slate-950 text-void font-sans">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <main className="grow pt-24 pb-20">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden -mt-24 pt-40 pb-20 px-6"
          style={{ background: 'transparent' }}
        >

          {/* Mouse-following glow */}
          <HeroGlow />

          <div className="max-w-3xl mx-auto text-center relative z-10">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-[#00B2FF]/10 border border-[#00B2FF]/20 rounded-full px-4 py-1.5 text-xs font-semibold text-[#00B2FF] mb-8"
            >
              <span className="w-1.5 h-1.5 bg-[#00B2FF] rounded-full animate-pulse" />
              Now in Phase 1: Audit
            </motion.div>

            {/* Headline - word-by-word entrance */}
            <motion.h1
              className="hero-title text-5xl sm:text-6xl md:text-7xl font-bold mb-6 text-gray-900 dark:text-white"
              variants={headlineContainer}
              initial="hidden"
              animate="visible"
            >
              {headlineWords.map((word, i) => (
                <motion.span
                  key={i}
                  variants={wordVariant}
                  className="inline-block mr-[0.28em] last:mr-0"
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            {/* Sub-headline */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.75, ease: "easeOut" }}
              className="text-xl sm:text-2xl text-gray-500 dark:text-gray-400 mb-10 font-medium"
            >
              This isn&apos;t AI for HR. This is HR for AI.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.95 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                href="/signup"
                className="btn-primary px-9 py-4 font-semibold text-sm uppercase rounded-lg inline-block text-center"
              >
                Try for Free
              </Link>
              <Link
                href="/demo"
                className="px-9 py-4 font-semibold text-sm uppercase border border-gray-300 dark:border-white/25 rounded-lg hover:border-gray-900 dark:hover:border-white/60 hover:text-gray-900 dark:hover:text-white transition text-center text-gray-600 dark:text-gray-300"
              >
                See the demo →
              </Link>
            </motion.div>
          </div>

          {/* Floating product card */}
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.1, ease: EASE }}
            className="mt-16 flex justify-center relative z-10"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700/60 shadow-2xl dark:shadow-[0_25px_50px_rgba(0,0,0,0.5)] p-5 w-80"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">sales_bot_v2</span>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">Active</span>
              </div>
              <div className="space-y-2.5 mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">MTD Spend</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100 font-semibold">$48.20</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Tasks completed</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100 font-semibold">1,204</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Budget used</span>
                  <span className="font-mono font-semibold" style={{ color: '#00B2FF' }}>64%</span>
                </div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 rounded-full" style={{ width: '64%', background: '#00B2FF' }} />
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">Department</span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Sales</span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Social proof bar ──────────────────────────────────── */}
        <FadeIn>
          <div className="border-y border-gray-200 dark:border-gray-700 py-10 px-6 bg-gray-50/60 dark:bg-gray-900/50">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 text-center mb-7">
                Works with your existing AI providers
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {[
                  { name: 'OpenAI',         color: '#10A37F' },
                  { name: 'Anthropic',      color: '#D4622A' },
                  { name: 'Google Gemini',  color: '#4285F4' },
                  { name: 'Meta Llama',     color: '#0668E1' },
                  { name: 'Mistral',        color: '#FF7000' },
                  { name: 'Cohere',         color: '#39594D' },
                  { name: 'DeepSeek',       color: '#4D6BFE' },
                ].map(({ name, color }) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 hover:border-gray-400 hover:shadow-sm transition-all cursor-default select-none"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        <div className="container mx-auto px-6">

          {/* ── Interactive demo ──────────────────────────────────── */}
          <FadeUp>
            <section className="pt-20 pb-4 bg-gray-50 dark:bg-gray-900 -mx-6 px-6 mt-16">
              <div className="container mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">

                  <div className="text-center md:text-left">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                      Managing your workforce shouldn&apos;t need tech knowledge
                    </h2>
                    <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                      Explore our demo to see how you can onboard, measure, and govern your AI workforce, no code required.
                    </p>
                    <Link href="/signup" className="btn-primary inline-block font-semibold px-8 py-4 shadow-sm">
                      Try for Free
                    </Link>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Takes less than 2 minutes. No credit card needed.</p>
                  </div>

                  {/* Carousel */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl relative overflow-hidden" style={{ minHeight: '480px' }}>

                    {/* Scene 0 */}
                    <div className="scene" style={sceneStyle(0)}>
                      <div className="w-full max-w-md text-center">
                        <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3.5 py-1.5 text-xs text-red-600 font-medium mb-3">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                          Agent trouble detected
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2">Your support agent is struggling</h3>
                        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-4 max-w-sm mx-auto">Customer satisfaction dropped 40% in one day. The agent is deflecting.</p>
                        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-left max-w-sm mx-auto mb-4">
                          <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1.5">support_bot_v3 &middot; Active</div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs"><span className="text-gray-600">Customer sat.</span><span className="text-red-500 font-semibold">58% <span className="text-red-400">(down 40%)</span></span></div>
                            <div className="flex justify-between text-xs"><span className="text-gray-600">Avg. resolution time</span><span className="text-red-500 font-semibold">12.4 min <span className="text-red-400">(up 280%)</span></span></div>
                            <div className="flex justify-between text-xs"><span className="text-gray-600">Escalation rate</span><span className="text-red-500 font-semibold">67% <span className="text-red-400">(up 45%)</span></span></div>
                          </div>
                        </div>
                        <button type="button" onClick={() => setCurrent(1)} className="btn-primary inline-flex items-center gap-1.5 font-semibold text-sm px-5 py-2.5 shadow-sm">
                          View performance report
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* Scene 1 */}
                    <div className="scene" style={sceneStyle(1)}>
                      <div className="w-full max-w-md text-center">
                        <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3.5 py-1.5 text-xs text-blue-600 font-medium mb-3">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          SynthForce insight
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2">Open its HR record</h3>
                        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-4 max-w-sm mx-auto">One click. The business manager opens the agent performance review like any employee record.</p>
                        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-left max-w-sm mx-auto mb-4">
                          <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1.5">Agent: support_bot_v3</div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mb-1.5"><div className="bg-yellow-400 h-2 rounded-full" style={{ width: '42%' }} /></div>
                          <div className="text-xs text-gray-700 font-medium">Performance score: 42 / 100</div>
                          <div className="text-xs text-gray-500 mt-1">Last 7 days: declining</div>
                        </div>
                        <button type="button" onClick={() => setCurrent(2)} className="btn-primary inline-flex items-center gap-1.5 font-semibold text-sm px-5 py-2.5 shadow-sm">
                          Run auto-diagnosis
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* Scene 2 */}
                    <div className="scene" style={sceneStyle(2)}>
                      <div className="w-full max-w-md text-center">
                        <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3.5 py-1.5 text-xs text-green-600 font-medium mb-3">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Optimized automatically
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2">SynthForce suggests a fix</h3>
                        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-4 max-w-sm mx-auto">The system proposes a configuration update based on the diagnosis.</p>
                        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-left max-w-sm mx-auto mb-4">
                          <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1.5">Auto-diagnosis result</div>
                          <div className="bg-green-100 text-green-800 text-xs font-medium rounded-lg p-2.5 mb-2 border border-green-200"><span className="font-bold">Root cause:</span> Escalation threshold too low. Response style mismatch.</div>
                          <div className="flex justify-between items-center">
                            <div><div className="text-xs font-semibold text-gray-900">Apply optimization</div><div className="text-xs text-gray-500">One click. No code.</div></div>
                            <span className="bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">Apply fix</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => setCurrent(3)} className="btn-primary inline-flex items-center gap-1.5 font-semibold text-sm px-5 py-2.5 shadow-sm">
                          Apply optimization
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* Scene 3 */}
                    <div className="scene" style={sceneStyle(3)}>
                      <div className="w-full max-w-md text-center">
                        <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-300 rounded-full px-3.5 py-1.5 text-xs text-green-700 font-medium mb-3">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Agent rescued
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2">Agent is back on track</h3>
                        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-4 max-w-sm mx-auto">The business owner clicked one button. The fix was applied in seconds. No developer needed.</p>
                        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-left max-w-sm mx-auto mb-4">
                          <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1.5">support_bot_v3 &middot; Healthy</div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs"><span className="text-gray-600">Customer sat.</span><span className="text-green-500 font-semibold">91% <span className="text-green-400">(up 33%)</span></span></div>
                            <div className="flex justify-between text-xs"><span className="text-gray-600">Avg. resolution time</span><span className="text-green-500 font-semibold">3.2 min <span className="text-green-400">(down 9.2 min)</span></span></div>
                            <div className="flex justify-between text-xs"><span className="text-gray-600">Escalation rate</span><span className="text-green-500 font-semibold">22% <span className="text-green-400">(down 45%)</span></span></div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-400">Fixed by: Automated optimization. 2.4 seconds.</div>
                        </div>
                        <button type="button" onClick={() => setCurrent(0)} className="inline-flex items-center gap-1.5 bg-gray-700 hover:bg-gray-800 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm transition">
                          Watch again
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* Dot nav */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                      {Array.from({ length: SCENE_COUNT }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCurrent(i)}
                          aria-label={`Show scene ${i + 1}`}
                          className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                          style={{
                            backgroundColor: i === current ? '#00B2FF' : '#D1D5DB',
                            transform: i === current ? 'scale(1.3)' : 'scale(1)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </FadeUp>

          {/* ── Problem ───────────────────────────────────────────── */}
          <section id="problem" className="pt-20 mb-32">
            <FadeUp>
              <h2 className="text-center text-4xl font-bold mb-12 dark:text-white">The Problem</h2>
            </FadeUp>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: EASE }}
                className="bg-white dark:bg-gray-800 border border-subtle dark:border-gray-700 p-8 rounded-2xl shadow-sm hover:-translate-y-2 transition-transform duration-300"
              >
                <div className="text-xs font-mono text-gray-500 mb-2">Infrastructure-only tools</div>
                <div className="font-mono text-sm text-gray-700 mb-4">CPU: 5%, RAM: 2GB, Latency: 200ms</div>
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">They see servers, not agents.</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">They track hardware metrics, not agent performance, cost, or business impact.</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: EASE }}
                className="bg-white dark:bg-gray-800 border border-subtle dark:border-gray-700 p-8 rounded-2xl shadow-sm relative overflow-hidden hover:-translate-y-2 transition-transform duration-300"
              >
                <div className="absolute top-0 right-0 bg-accent text-white text-xs font-bold px-2 py-1">SYNTHFORCE</div>
                <div className="text-xs font-mono text-gray-500 mb-2">HR for AI Agents</div>
                <div className="font-mono text-sm text-gray-700 mb-4">Agent: sales_bot_01 | Status: Active | Cost: $0.18/task</div>
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">We see employees.</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">We manage agents like employees: onboarding, performance reviews, policy enforcement, and offboarding.</p>
              </motion.div>
            </div>
          </section>

          {/* ── Solution ──────────────────────────────────────────── */}
          <motion.section
            id="solution"
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-32"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={staggerGrid}
          >
            {[
              {
                risk: "FINANCIAL RISK",
                title: "Budget Overspend.",
                body: "Agents can burn API credits in loops. We track spending per agent, set budgets, and automatically pause overspending agents before they break the budget.",
              },
              {
                risk: "LIABILITY RISK",
                title: "Unauthorized Promises.",
                body: "Agents can make promises they shouldn’t. We enforce policies (e.g., “no discounts >5%”) and block unauthorized commitments before they become liabilities.",
              },
              {
                risk: "COMPLIANCE RISK",
                title: "Role Violation.",
                body: "Agents can overstep their roles. We define role-based boundaries (e.g., “support bot cannot access production DB”) and enforce them automatically.",
              },
            ].map(({ risk, title, body }) => (
              <motion.div
                key={title}
                variants={fadeSlideUp}
                className="bg-white dark:bg-gray-800 p-8 group hover:bg-accent hover:text-white transition duration-300 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-transparent hover:shadow-md"
              >
                <div className="font-mono text-xs text-gray-500 dark:text-gray-400 group-hover:text-white mb-4">{risk}</div>
                <h3 className="text-2xl font-bold mb-4">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 group-hover:text-white">{body}</p>
              </motion.div>
            ))}
          </motion.section>

          {/* ── How it works ──────────────────────────────────────── */}
          <section id="how-it-works" className="mb-32">
            <FadeUp>
              <h2 className="text-center text-4xl font-bold mb-12 dark:text-white">How it works</h2>
            </FadeUp>
            <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 border border-subtle dark:border-gray-700 rounded-3xl p-8 md:p-12">
              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={staggerGrid}
              >
                {[
                  {
                    step: "01",
                    label: "Agent Directory",
                    desc: "See all your agents in one place. Assign owners, track status, and manage roles.",
                    mock: (
                      <div className="font-mono text-xs text-gray-500 border border-subtle rounded-lg p-4 space-y-1">
                        <div className="flex justify-between"><span>lead_gen_01</span><span className="text-green-500">Active</span></div>
                        <div className="flex justify-between"><span>support_bot</span><span className="text-yellow-500">Paused</span></div>
                        <div className="flex justify-between"><span>invoice_automator</span><span className="text-red-500">Over budget</span></div>
                      </div>
                    ),
                  },
                  {
                    step: "02",
                    label: "Performance Reviews",
                    desc: "Monthly performance reports with cost-per-task, error rate, and satisfaction scores.",
                    mock: (
                      <div className="font-mono text-xs text-gray-500 border border-subtle rounded-lg p-4 space-y-1">
                        <div className="flex justify-between"><span>Tasks completed</span><span>1,240</span></div>
                        <div className="flex justify-between"><span>Cost per task</span><span>$0.18</span></div>
                        <div className="flex justify-between"><span>Satisfaction</span><span>94% 👍</span></div>
                      </div>
                    ),
                  },
                  {
                    step: "03",
                    label: "Policy Manager",
                    desc: "Define guardrails in plain English. Enforce them automatically across all agents.",
                    mock: (
                      <div className="font-mono text-xs text-gray-500 border border-subtle rounded-lg p-4 space-y-1">
                        <div className="text-green-500">✓ No discounts &gt;5%</div>
                        <div className="text-green-500">✓ No PII access</div>
                        <div className="text-red-500">✗ Blocked: &quot;I promise a refund&quot;</div>
                      </div>
                    ),
                  },
                ].map(({ step, label, desc, mock }) => (
                  <motion.div key={step} variants={fadeSlideUp} className="space-y-4">
                    <div className="text-7xl font-bold leading-none select-none" style={{ color: 'rgba(0,178,255,0.22)' }}>{step}</div>
                    <div className="text-accent font-mono text-sm">{label}</div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">{desc}</p>
                    {mock}
                  </motion.div>
                ))}
              </motion.div>
              <div className="text-center mt-12">
                <Link href="/signup" className="btn-primary px-8 py-4 font-mono font-bold tracking-widest text-sm uppercase">
                  Try for Free
                </Link>
              </div>
            </div>
          </section>

          {/* ── Integrations ──────────────────────────────────────── */}
          <section className="py-20">
            <FadeUp>
              <div className="max-w-5xl mx-auto text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Already have agents? No worries.</h2>
                <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                  SynthForce works with the AI models and platforms you already use. Connect in minutes, no re-training needed.
                </p>
              </div>
            </FadeUp>
            <motion.div
              className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {[
                { name: 'OpenAI',       detail: 'GPT-5.5, GPT-5.4, GPT-5.4 mini', hover: 'hover:bg-blue-50',    text: 'group-hover:text-blue-600'    },
                { name: 'Anthropic',    detail: 'Opus 4.8, Sonnet 4.6, Haiku 4.5', hover: 'hover:bg-purple-50',  text: 'group-hover:text-purple-600'  },
                { name: 'Gemini',       detail: "Google’s latest models", hover: 'hover:bg-teal-50',    text: 'group-hover:text-teal-600'    },
                { name: 'Azure AI',     detail: "Microsoft’s cloud AI",   hover: 'hover:bg-sky-50',     text: 'group-hover:text-sky-600'     },
                { name: 'Llama',        detail: "Meta’s open models",     hover: 'hover:bg-indigo-50',  text: 'group-hover:text-indigo-600'  },
                { name: 'Cohere',       detail: 'Command, Embed',              hover: 'hover:bg-rose-50',    text: 'group-hover:text-rose-600'    },
                { name: 'Hugging Face', detail: 'Open-source models',          hover: 'hover:bg-orange-50',  text: 'group-hover:text-orange-600'  },
                { name: 'DeepSeek',     detail: 'DeepSeek Chat, Reasoner',     hover: 'hover:bg-amber-50',   text: 'group-hover:text-amber-600'   },
                { name: 'Groq',         detail: 'Ultra-fast inference',        hover: 'hover:bg-emerald-50', text: 'group-hover:text-emerald-600' },
                { name: 'Custom',       detail: 'Your own models',             hover: 'hover:bg-green-50',   text: 'group-hover:text-green-600'   },
              ].map(({ name, detail, hover, text }) => (
                <motion.div
                  key={name}
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
                  className={`integration-card group ${hover}`}
                >
                  <div className={`text-2xl font-bold text-gray-900 ${text} transition`}>{name}</div>
                  <div className="text-sm text-gray-500 mt-2">{detail}</div>
                </motion.div>
              ))}
            </motion.div>
            <FadeIn delay={0.3}>
              <p className="mt-12 text-sm text-gray-500 text-center max-w-5xl mx-auto">
                Plus on-prem deployments, fine-tuned models, and any API-based agent.
              </p>
            </FadeIn>
          </section>

        </div>
      </main>

      {/* ── Waitlist CTA ──────────────────────────────────────────── */}
      <section id="waitlist" className="py-24 relative overflow-hidden">
        {/* Callback blobs from hero */}
        <Blob className="w-[500px] h-[500px] bg-[#00B2FF]/[0.07] -top-24 -left-24" duration={11} dx={25} dy={15} />
        <Blob className="w-[400px] h-[400px] bg-[#00B2FF]/[0.05] -bottom-20 right-0" duration={9} dx={-20} dy={-25} delay={2} />

        <div className="container mx-auto px-6 relative z-10">
          <FadeUp>
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="hero-title text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
                Join the Waitlist
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-10">
                Be the first to get early access and a free agent-audit report.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-subtle dark:border-gray-700 p-10 max-w-2xl mx-auto">
                <div className="space-y-6">
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">What you&apos;ll get:</h3>
                    <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                      {([
                        <><strong>Early access</strong> to SynthForce before public launch</>,
                        <><strong>Free agent-audit report</strong> – see where your AI agents are leaking money</>,
                      ] as React.ReactNode[]).map((content, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-accent mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>{content}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-6 border-t border-subtle text-center">
                    <WaitlistTrigger className="btn-primary px-12 py-5 text-lg font-sans font-semibold uppercase rounded-lg inline-block cursor-pointer">
                      Join the Waitlist
                    </WaitlistTrigger>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No spam. Unsubscribe anytime.</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

    </div>
  );
}

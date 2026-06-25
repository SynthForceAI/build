"use client";

import { useState, useEffect } from "react";

type Phase =
  | "checking"    // reading localStorage → blue screen
  | "welcome"     // "Welcome" fades in
  | "sentence"    // "Manage Your Synthetic WorkForce" visible
  | "highlight"   // Synth + Force turn black, rest invisible
  | "synthforce"  // "SynthForce" coalesces at center
  | "fadeblue"    // blue overlay fades out, dashboard revealed
  | "done";       // overlay unmounted

const NEXT_PHASE: Partial<Record<Phase, Phase>> = {
  welcome:    "sentence",
  sentence:   "highlight",
  highlight:  "synthforce",
  synthforce: "fadeblue",
  fadeblue:   "done",
};

const PHASE_DURATION: Partial<Record<Phase, number>> = {
  welcome:    1800,
  sentence:   2600,
  highlight:   850,
  synthforce: 1500,
  fadeblue:   1000,
};

export function IntroAnimation({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const storageKey = `synthforce-skip-intro-${userId}`;

  useEffect(() => {
    setPhase(localStorage.getItem(storageKey) === "true" ? "done" : "welcome");
  }, [storageKey]);

  useEffect(() => {
    const duration = PHASE_DURATION[phase];
    const next = NEXT_PHASE[phase];
    if (!duration || !next) return;
    const t = setTimeout(() => setPhase(next), duration);
    return () => clearTimeout(t);
  }, [phase]);

  const handleSkip = () => {
    localStorage.setItem(storageKey, "true");
    setPhase("done");
  };

  if (phase === "done") return <>{children}</>;

  const overlayFading = phase === "fadeblue";

  return (
    <>
      {/* Dashboard rendered underneath so it's ready when overlay lifts */}
      {children}

      {/* Full-screen blue overlay */}
      <div
        className={`fixed inset-0 z-50 bg-[#00B2FF] flex items-center justify-center overflow-hidden transition-opacity duration-1000 ${
          overlayFading ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {/* Welcome */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${
            phase === "welcome" ? "opacity-100" : "opacity-0"
          }`}
        >
          <h1 className="text-8xl font-bold text-white tracking-tight select-none">
            Welcome
          </h1>
        </div>

        {/* Sentence — spans let us colour each token independently */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${
            phase === "sentence" || phase === "highlight" ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-4xl md:text-5xl font-semibold text-center px-6 select-none leading-tight">
            {/* "Manage Your " — fades into background on highlight */}
            <span
              className={`transition-colors duration-700 ${
                phase === "highlight" ? "text-[#00B2FF]" : "text-white"
              }`}
            >
              Manage Your{" "}
            </span>
            {/* "Synth" — turns black on highlight */}
            <span
              className={`transition-colors duration-700 ${
                phase === "highlight" ? "text-black font-bold" : "text-white"
              }`}
            >
              Synth
            </span>
            {/* "etic " — fades into background */}
            <span
              className={`transition-colors duration-700 ${
                phase === "highlight" ? "text-[#00B2FF]" : "text-white"
              }`}
            >
              etic{" "}
            </span>
            {/* "Work" — fades into background */}
            <span
              className={`transition-colors duration-700 ${
                phase === "highlight" ? "text-[#00B2FF]" : "text-white"
              }`}
            >
              Work
            </span>
            {/* "Force" — turns black on highlight */}
            <span
              className={`transition-colors duration-700 ${
                phase === "highlight" ? "text-black font-bold" : "text-white"
              }`}
            >
              Force
            </span>
          </p>
        </div>

        {/* SynthForce — scales up from 90% as it coalesces */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${
            phase === "synthforce"
              ? "opacity-100 scale-100"
              : "opacity-0 scale-90"
          }`}
        >
          <h1 className="text-7xl md:text-8xl font-bold text-white tracking-tight select-none">
            SynthForce
          </h1>
        </div>

        {/* Skip intro — bottom-right, unobtrusive */}
        <button
          onClick={handleSkip}
          className="absolute bottom-5 right-5 text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer"
        >
          Skip intro
        </button>
      </div>
    </>
  );
}

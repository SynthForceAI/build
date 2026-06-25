"use client";

import { useState, useEffect, useRef } from "react";

type Phase =
  | "checking"    // reading localStorage → show blue screen
  | "welcome"     // "Welcome" visible
  | "gap"         // 1-second empty blue between welcome and sentence
  | "sentence"    // full sentence visible
  | "highlight"   // Synth + Force → black; rest blends into background
  | "synthforce"  // Synth and Force translate toward each other and merge
  | "fadeblue"    // overlay fades out, dashboard revealed
  | "done";

const NEXT_PHASE: Partial<Record<Phase, Phase>> = {
  welcome:    "gap",
  gap:        "sentence",
  sentence:   "highlight",
  highlight:  "synthforce",
  synthforce: "fadeblue",
  fadeblue:   "done",
};

// "gap" = 500ms for welcome to finish fading + 1000ms of truly empty blue
const PHASE_DURATION: Partial<Record<Phase, number>> = {
  welcome:    1200,
  gap:        1500,
  sentence:   2500,
  highlight:   800,
  synthforce: 1900,
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
  const [synthTx, setSynthTx] = useState(0);
  const [forceTx, setForceTx] = useState(0);
  const synthRef = useRef<HTMLSpanElement>(null);
  const forceRef = useRef<HTMLSpanElement>(null);
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

  // When synthforce phase starts, measure where Synth and Force are and
  // calculate the translateX each needs to bring them together at center.
  useEffect(() => {
    if (phase !== "synthforce") return;
    const synthEl = synthRef.current;
    const forceEl = forceRef.current;
    if (!synthEl || !forceEl) return;

    const sr = synthEl.getBoundingClientRect();
    const fr = forceEl.getBoundingClientRect();
    const cx = window.innerWidth / 2;

    // Synth's right edge meets viewport center; Force's left edge meets it.
    setSynthTx(cx - sr.right);
    setForceTx(cx - fr.left);
  }, [phase]);

  const handleSkip = () => {
    localStorage.setItem(storageKey, "true");
    setPhase("done");
  };

  if (phase === "done") return <>{children}</>;

  const inSynthforce = phase === "synthforce";
  const sentenceVisible =
    phase === "sentence" ||
    phase === "highlight" ||
    phase === "synthforce";

  return (
    <>
      {/* Dashboard sits underneath so it's ready the moment overlay lifts */}
      {children}

      {/* Full-screen blue overlay */}
      <div
        className={`fixed inset-0 z-50 bg-[#00B2FF] flex items-center justify-center overflow-hidden transition-opacity duration-1000 ${
          phase === "fadeblue" ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {/* ── Welcome ── */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
            phase === "welcome" ? "opacity-100" : "opacity-0"
          }`}
        >
          <h1 className="text-8xl font-bold text-white tracking-tight select-none">
            Welcome
          </h1>
        </div>

        {/* ── Sentence (stays mounted through highlight + synthforce) ── */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
            sentenceVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-3xl sm:text-4xl md:text-5xl font-semibold text-center px-6 select-none leading-tight whitespace-nowrap">

            {/* "Manage Your " — blends into background during highlight */}
            <span
              style={{
                display: "inline-block",
                transition: "color 600ms",
                color:
                  phase === "highlight" || inSynthforce
                    ? "#00B2FF"
                    : "white",
              }}
            >
              Manage Your{" "}
            </span>

            {/* "Synth" — turns black, then slides right toward center */}
            <span
              ref={synthRef}
              style={{
                display: "inline-block",
                transition: "color 600ms, transform 750ms ease-in-out",
                color:
                  phase === "highlight" || inSynthforce ? "black" : "white",
                transform: inSynthforce
                  ? `translateX(${synthTx}px)`
                  : "translateX(0px)",
              }}
            >
              Synth
            </span>

            {/* "etic " — blends into background during highlight */}
            <span
              style={{
                display: "inline-block",
                transition: "color 600ms",
                color:
                  phase === "highlight" || inSynthforce
                    ? "#00B2FF"
                    : "white",
              }}
            >
              etic{" "}
            </span>

            {/* "Work" — blends into background during highlight */}
            <span
              style={{
                display: "inline-block",
                transition: "color 600ms",
                color:
                  phase === "highlight" || inSynthforce
                    ? "#00B2FF"
                    : "white",
              }}
            >
              Work
            </span>

            {/* "Force" — turns black, then slides left toward center */}
            <span
              ref={forceRef}
              style={{
                display: "inline-block",
                transition: "color 600ms, transform 750ms ease-in-out",
                color:
                  phase === "highlight" || inSynthforce ? "black" : "white",
                transform: inSynthforce
                  ? `translateX(${forceTx}px)`
                  : "translateX(0px)",
              }}
            >
              Force
            </span>
          </p>
        </div>

        {/* ── Skip intro ── */}
        <button
          onClick={handleSkip}
          className="absolute bottom-5 right-5 text-black text-sm font-medium hover:opacity-60 transition-opacity cursor-pointer"
        >
          Skip intro
        </button>
      </div>
    </>
  );
}

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

// gap = ~500ms for welcome fade + 1000ms of truly empty blue
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
  skip = false,
  children,
}: {
  userId: string;
  skip?: boolean;
  children: React.ReactNode;
}) {
  // When the server has already determined skip via cookie, start at "done"
  const [phase, setPhase] = useState<Phase>(skip ? "done" : "checking");
  const [synthTx, setSynthTx] = useState(0);
  const [forceTx, setForceTx] = useState(0);
  const synthRef = useRef<HTMLSpanElement>(null);
  const forceRef = useRef<HTMLSpanElement>(null);
  const storageKey = `synthforce-skip-intro-${userId}`;

  useEffect(() => {
    if (skip) return;
    setPhase(localStorage.getItem(storageKey) === "true" ? "done" : "welcome");
  }, [skip, storageKey]);

  useEffect(() => {
    const duration = PHASE_DURATION[phase];
    const next = NEXT_PHASE[phase];
    if (!duration || !next) return;
    const t = setTimeout(() => setPhase(next), duration);
    return () => clearTimeout(t);
  }, [phase]);

  // When synthforce phase starts, measure where Synth and Force currently are
  // and calculate how far each must translate to meet at viewport center.
  useEffect(() => {
    if (phase !== "synthforce") return;
    const synthEl = synthRef.current;
    const forceEl = forceRef.current;
    if (!synthEl || !forceEl) return;

    const sr = synthEl.getBoundingClientRect();
    const fr = forceEl.getBoundingClientRect();
    const cx = window.innerWidth / 2;

    setSynthTx(cx - sr.right);   // Synth's right edge → viewport center
    setForceTx(cx - fr.left);    // Force's left edge  → viewport center
  }, [phase]);

  const handleSkip = () => {
    localStorage.setItem(storageKey, "true");
    // Cookie lets the server skip the overlay on the next page load
    document.cookie = `synthforce-skip-intro=1; path=/; max-age=31536000; SameSite=Lax`;
    setPhase("done");
  };

  if (phase === "done") return <>{children}</>;

  const inSynthforce = phase === "synthforce";
  const sentenceVisible =
    phase === "sentence" || phase === "highlight" || phase === "synthforce";
  const overlayFading = phase === "fadeblue";

  return (
    <>
      {/* Dashboard sits underneath so it's ready the moment the overlay lifts */}
      {children}

      {/* Full-screen blue overlay — inline styles ensure it covers the page
          even in the brief window before Tailwind CSS loads. */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          backgroundColor: "#00B2FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          opacity: overlayFading ? 0 : 1,
          transition: overlayFading ? "opacity 1000ms" : undefined,
          pointerEvents: overlayFading ? "none" : undefined,
        }}
      >
        {/* ── Welcome ── */}
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: phase === "welcome" ? 1 : 0,
            transition: "opacity 500ms",
          }}
        >
          <h1 className="text-8xl font-bold text-white tracking-tight select-none">
            Welcome
          </h1>
        </div>

        {/* ── Sentence (stays mounted through highlight + synthforce) ── */}
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: sentenceVisible ? 1 : 0,
            transition: "opacity 500ms",
          }}
        >
          <p className="text-3xl sm:text-4xl md:text-5xl font-semibold text-center px-6 select-none leading-tight whitespace-nowrap">

            {/* "Manage Your " — blends into background during highlight */}
            <span
              style={{
                display: "inline-block",
                transition: "color 600ms",
                color: phase === "highlight" || inSynthforce ? "#00B2FF" : "white",
              }}
            >
              Manage Your{" "}
            </span>

            {/* "Synth" — turns black, then slides right to meet Force */}
            <span
              ref={synthRef}
              style={{
                display: "inline-block",
                color: phase === "highlight" || inSynthforce ? "black" : "white",
                transform: inSynthforce ? `translateX(${synthTx}px)` : "translateX(0px)",
                transition: "color 600ms, transform 750ms ease-in-out",
              }}
            >
              Synth
            </span>

            {/* "etic " — blends into background */}
            <span
              style={{
                display: "inline-block",
                transition: "color 600ms",
                color: phase === "highlight" || inSynthforce ? "#00B2FF" : "white",
              }}
            >
              etic{" "}
            </span>

            {/* "Work" — blends into background */}
            <span
              style={{
                display: "inline-block",
                transition: "color 600ms",
                color: phase === "highlight" || inSynthforce ? "#00B2FF" : "white",
              }}
            >
              Work
            </span>

            {/* "Force" — turns black, then slides left to meet Synth */}
            <span
              ref={forceRef}
              style={{
                display: "inline-block",
                color: phase === "highlight" || inSynthforce ? "black" : "white",
                transform: inSynthforce ? `translateX(${forceTx}px)` : "translateX(0px)",
                transition: "color 600ms, transform 750ms ease-in-out",
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

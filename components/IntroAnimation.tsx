"use client";

import { useState, useEffect, useRef } from "react";

type Phase =
  | "checking"
  | "welcome"
  | "gap"
  | "sentence"
  | "highlight"
  | "synthforce"  // Synth + Force slide to center
  | "fadeblue"    // SynthForce zooms toward viewer + overlay fades
  | "done";

const NEXT_PHASE: Partial<Record<Phase, Phase>> = {
  welcome:    "gap",
  gap:        "sentence",
  sentence:   "highlight",
  highlight:  "synthforce",
  synthforce: "fadeblue",
  fadeblue:   "done",
};

// gap = ~500ms for welcome to finish fading + 1000ms of empty blue
const PHASE_DURATION: Partial<Record<Phase, number>> = {
  welcome:    1200,
  gap:        1500,
  sentence:   2500,
  highlight:   800,
  synthforce: 1900,
  fadeblue:   1100,
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
  const [phase, setPhase] = useState<Phase>(skip ? "done" : "checking");
  const [synthTx, setSynthTx] = useState(0);
  const [forceTx, setForceTx] = useState(0);
  const synthRef = useRef<HTMLSpanElement>(null);
  const forceRef = useRef<HTMLSpanElement>(null);
  const storageKey = `synthforce-skip-intro-${userId}`;
  const skippedRef = useRef(false);

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

  // When the intro plays all the way through (not skipped), mark it as played
  // for this login session so it doesn't replay across tabs or page navigations.
  // The cookie is cleared on logout so it plays again after the next login.
  useEffect(() => {
    if (phase === "done" && !skip && !skippedRef.current) {
      document.cookie = "synthforce-intro-played=1; path=/; max-age=2592000; SameSite=Lax";
    }
  }, [phase, skip]);

  // When synthforce phase starts, measure Synth and Force positions and
  // calculate the translateX each needs to meet at viewport center.
  useEffect(() => {
    if (phase !== "synthforce") return;
    const synthEl = synthRef.current;
    const forceEl = forceRef.current;
    if (!synthEl || !forceEl) return;

    const sr = synthEl.getBoundingClientRect();
    const fr = forceEl.getBoundingClientRect();
    const cx = window.innerWidth / 2;

    setSynthTx(cx - sr.right);  // Synth's right edge → viewport center
    setForceTx(cx - fr.left);   // Force's left edge  → viewport center
  }, [phase]);

  const handleSkip = () => {
    skippedRef.current = true;
    localStorage.setItem(storageKey, "true");
    document.cookie = `synthforce-skip-intro=1; path=/; max-age=31536000; SameSite=Lax`;
    setPhase("done");
  };

  if (phase === "done") return <>{children}</>;

  const inSynthforce  = phase === "synthforce";
  const inFadeblue    = phase === "fadeblue";
  // Keep the sentence mounted through fadeblue so the scale+fade transition
  // can play — we control its opacity manually below.
  const sentenceMounted =
    phase === "sentence" || phase === "highlight" || inSynthforce || inFadeblue;

  // During fadeblue the word zooms toward the viewer (Netflix-style) and fades.
  // During all other non-sentence phases it just fades to 0 instantly.
  const sentenceOpacity = sentenceMounted ? (inFadeblue ? 0 : 1) : 0;
  const sentenceScale   = inFadeblue ? "scale(1.45)" : "scale(1)";
  const sentenceTransition = inFadeblue
    ? "opacity 700ms ease-in, transform 700ms ease-in"
    : "opacity 500ms";

  const highlightActive = phase === "highlight" || inSynthforce || inFadeblue;

  return (
    <>
      {children}

      {/* Full-screen blue overlay — critical layout via inline styles so it
          covers the page even before Tailwind CSS loads. */}
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
          opacity: inFadeblue ? 0 : 1,
          transition: inFadeblue ? "opacity 1100ms ease-in" : undefined,
          pointerEvents: inFadeblue ? "none" : undefined,
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
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold text-white tracking-tight select-none">
            Welcome
          </h1>
        </div>

        {/* ── Sentence — stays mounted through fadeblue for the zoom-out ── */}
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: sentenceOpacity,
            transform: sentenceScale,
            transition: sentenceTransition,
            // Scale from the center of the viewport (where SynthForce lands)
            transformOrigin: "center center",
          }}
        >
          {/*
            Spaces: "Synth" and "Force" are display:inline-block (required for
            translateX transforms). The other spans use the default display:inline.
            Spaces are encoded as non-breaking spaces ( ) so browsers
            cannot strip them as trailing whitespace on an inline-block box.
          */}
          <p className="text-sm sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-center px-6 select-none leading-tight whitespace-nowrap">

            {/* "Manage Your " — blends into background on highlight */}
            <span
              style={{
                color: highlightActive ? "#00B2FF" : "white",
                transition: "color 600ms",
              }}
            >
              {"Manage Your "}
            </span>

            {/* "Synth" — turns black, slides right to meet Force */}
            <span
              ref={synthRef}
              style={{
                display: "inline-block",
                color: highlightActive ? "black" : "white",
                transform: inSynthforce || inFadeblue
                  ? `translateX(${synthTx}px)`
                  : "translateX(0px)",
                transition: "color 600ms, transform 750ms ease-in-out",
              }}
            >
              Synth
            </span>

            {/* "etic " — blends into background on highlight */}
            <span
              style={{
                color: highlightActive ? "#00B2FF" : "white",
                transition: "color 600ms",
              }}
            >
              {"etic "}
            </span>

            {/* "Work" — blends into background on highlight */}
            <span
              style={{
                color: highlightActive ? "#00B2FF" : "white",
                transition: "color 600ms",
              }}
            >
              Work
            </span>

            {/* "Force" — turns black, slides left to meet Synth */}
            <span
              ref={forceRef}
              style={{
                display: "inline-block",
                color: highlightActive ? "black" : "white",
                transform: inSynthforce || inFadeblue
                  ? `translateX(${forceTx}px)`
                  : "translateX(0px)",
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

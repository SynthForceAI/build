"use client";

import { useState, useRef, useEffect } from "react";

type Coords = { x: number; y: number; below: boolean } | null;

export function InfoTip({ text }: { text: string }) {
  const [coords, setCoords] = useState<Coords>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const btnRef = useRef<HTMLSpanElement>(null);

  function computeCoords(): Coords {
    if (!btnRef.current) return null;
    const r = btnRef.current.getBoundingClientRect();
    const below = r.top < 180;
    return {
      x: r.left + r.width / 2,
      // below: anchor to bottom of icon; above: anchor to top of icon
      y: below ? r.bottom + 8 : r.top - 8,
      below,
    };
  }

  function onEnter() {
    timer.current = setTimeout(() => setCoords(computeCoords()), 300);
  }

  function onLeave() {
    clearTimeout(timer.current);
    setCoords(null);
  }

  function onTap(e: React.MouseEvent) {
    e.stopPropagation();
    setCoords((c) => (c ? null : computeCoords()));
  }

  // Close on any outside click (mobile tap-away)
  useEffect(() => {
    if (!coords) return;
    const hide = () => setCoords(null);
    document.addEventListener("click", hide);
    return () => document.removeEventListener("click", hide);
  }, [coords]);

  return (
    <>
      <span
        ref={btnRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onTap}
        className="inline-flex items-center justify-center ml-0.5 -top-0.5 align-middle w-3.5 h-3.5 rounded-full bg-gray-100 border border-gray-300 text-gray-400 text-[9px] font-bold cursor-help select-none leading-none shrink-0"
        aria-label="More info"
      >
        ?
      </span>

      {coords && (
        <span
          style={{
            position: "fixed",
            left: `${coords.x}px`,
            top: `${coords.y}px`,
            // below icon: top of tooltip = coords.y, shift left to centre
            // above icon: bottom of tooltip = coords.y, shift left + up
            transform: coords.below
              ? "translateX(-50%)"
              : "translateX(-50%) translateY(-100%)",
            zIndex: 9999,
          }}
          className="w-64 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 leading-relaxed pointer-events-none shadow-xl whitespace-normal"
        >
          {text}
          {/* Arrow caret */}
          <span
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              ...(coords.below
                ? { bottom: "100%", borderBottom: "5px solid #111827" }
                : { top: "100%",    borderTop:    "5px solid #111827" }),
            }}
            aria-hidden="true"
          />
        </span>
      )}
    </>
  );
}

"use client";

import { useState, useRef } from "react";

export function InfoTip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [above, setAbove] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const btnRef = useRef<HTMLSpanElement>(null);

  function onEnter() {
    // Decide whether to show above or below based on available space
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setAbove(rect.top > 160);
    }
    timer.current = setTimeout(() => setVisible(true), 900);
  }

  function onLeave() {
    clearTimeout(timer.current);
    setVisible(false);
  }

  // Mobile tap toggle
  function onTap(e: React.MouseEvent) {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setAbove(rect.top > 160);
    }
    setVisible((v) => !v);
  }

  return (
    <span className="relative inline-flex items-center ml-0.5 -top-0.5 align-middle">
      <span
        ref={btnRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onTap}
        className="w-3.5 h-3.5 rounded-full bg-gray-100 border border-gray-300 text-gray-400 text-[9px] font-bold inline-flex items-center justify-center cursor-help select-none leading-none"
        aria-label="More info"
      >
        ?
      </span>
      {visible && (
        <span
          className={
            "absolute left-1/2 -translate-x-1/2 w-64 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 leading-relaxed pointer-events-none z-50 shadow-xl whitespace-normal " +
            (above ? "bottom-full mb-2" : "top-full mt-2")
          }
        >
          {text}
          <span
            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${above ? "top-full" : "bottom-full rotate-180"}`}
            style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #111827" }}
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
}

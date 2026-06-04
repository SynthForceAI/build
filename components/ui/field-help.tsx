"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  text: string;
  href?: string;
  hrefLabel?: string;
};

export function FieldHelp({ text, href, hrefLabel }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center ml-1.5">
      <button
        type="button"
        aria-label="Show help"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 text-[10px] font-bold leading-none flex items-center justify-center hover:bg-[#00B2FF]/10 hover:text-[#00B2FF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B2FF]"
      >
        ?
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-50 leading-relaxed"
        >
          {text}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-1 text-[#00B2FF] underline"
              onClick={() => setOpen(false)}
            >
              {hrefLabel ?? "Learn more"}
            </a>
          )}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

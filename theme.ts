// Design tokens extracted from app/demo/page.tsx, components/ui/*, and app/globals.css

export const theme = {
  // ── Brand palette ──────────────────────────────────────────────────────────
  color: {
    // SynthForce brand constants (from globals.css @theme)
    void: "#000000",
    paper: "#FFFFFF",
    subtle: "#e5e5e5",
    accent: "#00B2FF",

    // Page chrome
    pageBg: "bg-gray-50",          // outermost page background
    surfaceBg: "bg-white",         // card / panel surface
    surfaceBgMuted: "bg-gray-50",  // inset panels (e.g. API integration box)
    navBg: "bg-white/90",          // sticky navbar (with backdrop-blur)
    overlayBg: "bg-black/50",      // modal scrim

    // Text
    textPrimary: "text-gray-900",
    textBody: "text-gray-700",
    textMuted: "text-gray-600",
    textSubtle: "text-gray-500",
    textDisabled: "text-gray-400",
    textAccent: "text-[#00B2FF]",
    textLink: "text-blue-600",
    textLinkHover: "hover:text-blue-800",

    // Borders
    border: "border-gray-200",
    borderInput: "border-gray-300",
    borderAccent: "border-[#00B2FF]",
    borderHoverAccent: "hover:border-blue-300",

    // Shadcn CSS-variable equivalents (oklch → approx hex)
    cssBackground: "oklch(1 0 0)",           // #ffffff
    cssForeground: "oklch(0.145 0 0)",       // #1a1a1a
    cssPrimary: "oklch(0.205 0 0)",          // #1f1f1f
    cssPrimaryFg: "oklch(0.985 0 0)",        // #f9f9f9
    cssSecondary: "oklch(0.97 0 0)",         // #f5f5f5
    cssMuted: "oklch(0.97 0 0)",             // #f5f5f5
    cssMutedFg: "oklch(0.556 0 0)",          // ~#6b6b6b
    cssBorder: "oklch(0.922 0 0)",           // ~#e5e5e5
    cssInput: "oklch(0.922 0 0)",            // ~#e5e5e5
    cssRing: "oklch(0.708 0 0)",             // ~#ababab
    cssDestructive: "oklch(0.577 0.245 27.325)", // red
  },

  // ── Status / semantic colors ────────────────────────────────────────────────
  status: {
    active: {
      dot: "bg-green-500",
      pill: "bg-green-100 text-green-800",
    },
    paused: {
      dot: "bg-yellow-500",
      pill: "bg-yellow-100 text-yellow-800",
    },
    overBudget: {
      dot: "bg-red-500",
      pill: "bg-red-100 text-red-800",
    },
    training: {
      dot: "bg-blue-500",
      pill: "bg-blue-100 text-blue-800",
    },
    pending: {
      dot: "bg-yellow-500",
      pill: "bg-yellow-100 text-yellow-800",
    },
  },

  // ── Stat card tones ─────────────────────────────────────────────────────────
  statTone: {
    blue: "bg-blue-50",
    green: "bg-green-50",
    purple: "bg-purple-50",
    yellow: "bg-yellow-50",
    red: "bg-red-50",
  },

  // ── Typography ──────────────────────────────────────────────────────────────
  font: {
    sans: "var(--font-inter), system-ui, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    // Tailwind utility classes
    classSans: "font-sans",
    classMono: "font-mono",
    classBold: "font-bold",
    classMedium: "font-medium",
  },

  fontSize: {
    xs: "text-xs",    // 12px - pill labels, timestamps
    sm: "text-sm",    // 14px - body / table cells
    base: "text-base",// 16px
    lg: "text-lg",    // 18px - sidebar headers, panel titles
    xl: "text-xl",
    "2xl": "text-2xl",// 24px - section headings
    "3xl": "text-3xl",// 30px - page titles
  },

  // ── Border radius ───────────────────────────────────────────────────────────
  radius: {
    base: "0.625rem",  // CSS var(--radius)
    sm: "rounded-lg",  // buttons, inputs, table badges (~8px)
    md: "rounded-xl",  // agent cards, small panels (~12px)
    lg: "rounded-2xl", // main content panels, sidebar (~16px)
    full: "rounded-full", // status pills
    // Shadcn scale (relative to --radius: 0.625rem)
    shadcnSm: "calc(0.625rem * 0.6)",  // ~0.375rem
    shadcnMd: "calc(0.625rem * 0.8)",  // ~0.5rem
    shadcnLg: "0.625rem",
    shadcnXl: "calc(0.625rem * 1.4)",  // ~0.875rem
    shadcn2xl: "calc(0.625rem * 1.8)", // ~1.125rem
    shadcn3xl: "calc(0.625rem * 2.2)", // ~1.375rem
    shadcn4xl: "calc(0.625rem * 2.6)", // ~1.625rem (badge pill)
  },

  // ── Shadows ─────────────────────────────────────────────────────────────────
  shadow: {
    xs: "shadow-xs",  // shadcn components (input, card)
    sm: "shadow-sm",  // demo page panels
    lg: "shadow-lg",  // onboard option cards on hover
    xl: "shadow-xl",  // modal dialog
  },

  // ── Spacing scale (Tailwind p/gap values used in demo) ──────────────────────
  spacing: {
    // Padding
    p2: "p-2",
    p4: "p-4",
    p5: "p-5",
    p6: "p-6",
    p8: "p-8",
    // Gaps
    gap2: "gap-2",
    gap4: "gap-4",
    gap6: "gap-6",
    gap8: "gap-8",
    // Margin / section separation
    mb2: "mb-2",
    mb4: "mb-4",
    mb6: "mb-6",
    mb8: "mb-8",
    mb10: "mb-10",
    mb12: "mb-12",
    // Form fields
    px4py3: "px-4 py-3", // select / input padding
    px5py2_5: "px-5 py-2.5", // primary button
    px6py3: "px-6 py-3",     // full-width button
  },

  // ── Component presets ────────────────────────────────────────────────────────
  component: {
    // Primary CTA button (accent fill → ghost on hover)
    buttonPrimary:
      "bg-[#00B2FF] text-white border border-[#00B2FF] rounded-lg hover:bg-transparent hover:text-[#00B2FF] transition",

    // Main content card
    cardMain:
      "bg-white rounded-2xl border border-gray-200 shadow-sm",

    // Small card (agent cards, connected-agent row)
    cardSm:
      "bg-white border border-gray-200 rounded-xl",

    // Inset panel (API form, error list, audit box)
    panelInset:
      "bg-gray-50 p-6 rounded-xl",

    // Sidebar nav item - active
    navItemActive:
      "bg-blue-50 border-[#00B2FF] text-[#00B2FF]",

    // Sidebar nav item - inactive
    navItemInactive:
      "border-transparent text-gray-700 hover:bg-gray-50 hover:border-blue-300",

    // Table header row
    tableHead: "bg-gray-100 text-gray-700",

    // Table body row
    tableRow: "border-b hover:bg-gray-50",

    // Navbar
    navbar:
      "sticky top-0 w-full z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md",

    // Modal dialog wrapper
    modalDialog:
      "inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl",

    // Modal footer strip
    modalFooter: "bg-gray-50 px-6 py-4",
  },
} as const;

export type Theme = typeof theme;

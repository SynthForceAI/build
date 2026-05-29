import { defineConfig } from "vitest/config";

export default defineConfig({
  // Override PostCSS so Vitest's Vite pipeline doesn't try to load Tailwind
  // v4's string-form postcss.config.mjs (which it can't parse). Tests don't
  // need CSS processing.
  css: { postcss: { plugins: [] } },
  // Pass (exit 0) when no test files exist yet, instead of failing CI.
  test: { passWithNoTests: true },
});

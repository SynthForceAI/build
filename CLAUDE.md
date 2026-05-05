# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The SynthForce marketing site (`synthforceai.com`). Pure static HTML + Tailwind via CDN, deployed on Vercel. There is no framework, no bundler, and no build step — `package.json`'s `build` script is a no-op echo. The only npm dependency (`@vercel/analytics`) is unused at runtime; analytics is loaded via a `<script defer src="https://cdn.vercel-insights.com/v1/script.js">` tag inlined in each page.

## Common commands

- **Local preview:** `vercel dev` (no other dev server exists; opening HTML files directly will not exercise the `vercel.json` routing rules).
- **Deploy preview:** `vercel`
- **Deploy production:** `vercel --prod` (custom domain `synthforceai.com` via `CNAME`).
- **Install deps:** `npm install` — only needed if touching `api/sitemap.js` locally.

There are no tests, no linter, and no typecheck. Do not invent commands for them.

## Architecture: how URLs resolve

Three things conspire to map clean URLs to the file tree, and they must stay in sync:

1. **`vercel.json` `builds`** declares `**/*.html` and `assets/**` as static. The legacy `builds` config preserves source paths in the deployed output, so `src/pages/index.html` ships at `/src/pages/index.html` — not `/index.html`.
2. **`vercel.json` `routes`** rewrites clean URLs (e.g. `/about` → `/about.html`) and finally falls through to `/index.html` for unmatched paths.
3. **Sitemap is dual-served:** `api/sitemap.js` is a Vercel Function that reads `sitemap.xml` from `process.cwd()` and returns it; `vercel.json` routes `/sitemap.xml` to that function. Updating the sitemap means editing `sitemap.xml` at the repo root — `sitemap.txt` is a separate, simpler list and is not authoritative.

When adding a page, you typically need to touch four places: the HTML file, the `routes` array in `vercel.json` (clean-URL → `.html` rewrite), `sitemap.xml`, and any nav links in existing pages.

### Known path mismatches to watch for

A recent restructure (commit `190a714`, "Reorganize repo structure: src/pages, src/assets") moved files but did not fully update routing. Before assuming a clean-URL link works in production, verify the chain end-to-end:

- **Routes target root-level paths that no longer exist on disk.** `vercel.json` rewrites like `/about` → `/about.html` and `/(.*)` → `/index.html`, but the HTML lives under `src/pages/`. Either `vercel.json` needs `dest` paths updated to `/src/pages/*.html`, or the files need to move back to root.
- **Pages mix `../assets/...` (relative) and `/assets/...` (absolute) references** — see e.g. `src/pages/index.html:8` vs `:141`. Absolute `/assets/...` requires assets at the repo root; they currently live at `src/assets/`. The legacy `builds` entry `assets/**` also points at a non-existent path.
- **`/blog/posts/<slug>` is referenced from `blog.html`, `vercel.json`, and `sitemap.xml`, but the only post is at `blog/the-agent-explosion-how-to-prepare.html`** — there is no `blog/posts/` directory. Either the file needs to move into `blog/posts/` or the references need to change.

If you're asked to add a page or fix a link and these mismatches are in scope, treat them as the actual bug rather than adding more layers of routing on top.

## Branding constants

These appear hand-coded in every page's inlined Tailwind config and CSS — keep them consistent when adding pages:

- Colors: `void #000000`, `paper #FFFFFF`, `subtle #e5e5e5`, `accent #00B2FF`
- Fonts: Inter (Google Fonts), monospace fallback chain for the `mono` family
- Logo: `src/assets/logo_top_corner.png` in the nav, `src/assets/logo_homepage.png` in the hero

## Ownership

Proprietary; see `COPYRIGHT`. Owner: Samarth Kambli. Engineering: Matthew Gomez-Morales.

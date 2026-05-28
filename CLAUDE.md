# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What SynthForce is

SynthForce (`synthforceai.com`) is an HR platform for AI agents — an AI SaaS that lets companies "hire," manage, and govern AI agents the way they'd manage human staff: with departments, managers, budgets, policies, and audit trails.

The repo serves two roles:
1. **Marketing site** — the public-facing pages at synthforceai.com (home, product, about, demo, blog, waitlist).
2. **Product** — the authenticated app surface (currently being scaffolded) where customers will connect provider keys, create/manage agents, set policies, and view usage.

There is also a free "agent audit" wedge product: customers connect an OpenAI key, we pull billing data, run deterministic analysis, and return a plain-English cost-optimization report. It shares the same database and code surface as the full platform.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack dev) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Radix |
| Backend | Next.js Route Handlers (`app/api/**`) |
| Database | PostgreSQL on Supabase |
| ORM | Prisma 6 |
| Auth | Supabase Auth (SSR cookies) |
| Validation | Zod |
| Tests | Vitest |
| Hosting | Vercel (Fluid Compute, Node 24) |
| Analytics | `@vercel/analytics` |

## Repo layout

```
app/                  Next.js App Router pages + API routes
  api/                Route Handlers (agents, departments, policies, audits, etc.)
  about, blog, demo, product, waitlistsignup, page.tsx, layout.tsx
components/ui/        shadcn-style UI components (incl. site-nav)
hooks/                Reusable React hooks
lib/                  Server-side library code
  audit/              Free-audit engine, report generator, orchestrator
  providers/          External provider clients (e.g. openai-billing)
  supabase/           SSR + browser + proxy Supabase clients
  validators/         Zod schemas for API request bodies
  auth.ts, db.ts, crypto.ts, env.ts, api-errors.ts, serialize.ts, fonts.ts, utils.ts
prisma/               schema.prisma + migrations + seed.ts
public/assets/        Logos, favicons, integration icons
legacy-html/          Pre-migration static HTML site, kept for reference
proxy.ts         Supabase session refresh (see note below)
blog/                 Legacy blog HTML still served from root
```

## Branching model

- `main` — production (still the legacy static site at the time of writing).
- `nextjs-migration` — long-lived integration branch for the Next.js rewrite. Most current frontend work lands here.
- `backend/audit-foundation` — backend scaffold (Prisma schema, Supabase auth, API routes, free-audit pipeline) forked off `nextjs-migration`.

Feature branches PR back into their parent. `backend/audit-foundation` → `nextjs-migration` → eventually `main`.

## Common commands

```bash
npm run dev               # next dev --turbopack
npm run build             # next build
npm run lint              # next lint
npm run test              # vitest run
npm run test:watch        # vitest in watch mode

npm run db:generate       # prisma generate (Prisma client)
npm run db:migrate:dev    # prisma migrate dev (local schema changes)
npm run db:migrate        # prisma migrate deploy (CI/prod)
npm run db:studio         # prisma studio (browse DB)
```

### CI/CD

Deploys are handled by Vercel's Git integration — no GitHub Actions workflow lives in this repo.

**Automatic on push:**
- Push to any branch → Vercel builds a **preview deployment** with a unique URL.
- Push to the production branch (currently `main`) → Vercel builds and promotes a **production deployment** to `synthforceai.com`.
- Pull requests get a preview URL posted as a check; merging the PR triggers a new build for the base branch.

**Manual via Vercel CLI** (from the repo root, after `vercel link` has run once):

```bash
vercel                       # deploy current branch to a preview URL
vercel --prod                # deploy current branch straight to production (skips PR flow)
vercel env pull .env.local   # sync env vars from Vercel into local .env.local
vercel logs <url>            # tail logs for a deployment
```

**Database migrations are NOT auto-run on deploy.** `prisma migrate deploy` must be invoked manually (or wired into a future build step) after merging schema changes — Vercel only runs `next build`. Run it locally against the prod DB, or via a one-off Vercel-linked CLI session, before the deploy that depends on the new schema.

## Conventions

- **Server Components by default.** Add `'use client'` only when a component needs hooks, browser APIs, or event handlers.
- **API routes return JSON via `NextResponse`** and use `handleApiError` from `lib/api-errors.ts` for uniform error shapes. Auth gating goes through `requireUser()` / `requireRole()` from `lib/auth.ts`.
- **All request bodies validated with Zod schemas** from `lib/validators/`. Never trust the client.
- **BigInt and Decimal columns** must be serialized via `lib/serialize.ts` before sending to the client (JSON can't represent them).
- **Provider API keys** are AES-256-GCM encrypted at rest via `lib/crypto.ts`. Never log or return `encrypted_key`.
- **Small reusable helpers** go in `lib/utils.ts` or topic-specific files under `lib/` — not inlined in components.
- **Tailwind v4** — config is CSS-first (`app/globals.css`). No `tailwind.config.js`.
- **Don't edit `legacy-html/`** unless explicitly asked; it's a frozen reference of the pre-Next.js site.

## Branding constants

These should match across pages. Tokens live in `app/globals.css`.

- Colors: `void #000000`, `paper #FFFFFF`, `subtle #e5e5e5`, `accent #00B2FF`
- Font: Inter (loaded via `next/font` in `lib/fonts.ts`); monospace fallback for the `mono` family
- Logos in `public/assets/`: `logo_top_corner.png` (nav), `logo_homepage.png` (hero)

## Known gotchas

- **Backend scaffold is not yet runnable end-to-end.** Missing pieces: `.env.example`, `POST /api/audits` route, audit dashboard pages, and a populated `.env` (`DATABASE_URL`, `DIRECT_URL`, Supabase keys, `MASTER_ENCRYPTION_KEY`). The scaffold's commit message lists the gaps.
- **Supabase + PgBouncer:** when wiring the pooler, it must run in **transaction mode**, not session mode. Session mode would persist `app.current_tenant_id` across pool connections and leak data between tenants. RLS depends on this.

## Ownership

Proprietary; see `COPYRIGHT`. Owner: Samarth Kambli. Engineering: Matthew Gomez-Morales.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

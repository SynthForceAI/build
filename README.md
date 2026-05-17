# SynthForce

**HR for AI agents.** A governance, budgeting, and audit layer that lets companies hire, manage, and oversee AI agent workforces the way they manage human staff.

Production site: [synthforceai.com](https://synthforceai.com)

## Status

The site is in the middle of a Next.js rewrite.

- `main` — legacy static HTML site (still serving production).
- `nextjs-migration` — Next.js + Tailwind v4 rewrite of the marketing site. Frontend is complete.
- `backend/audit-foundation` — Prisma + Supabase backend scaffold, including the free OpenAI billing audit pipeline. Not yet end-to-end runnable (needs `.env`, Supabase project, and a few missing routes — see CLAUDE.md "Known gotchas").
- Current Tasks: Turn backend scaffold into a fuly-functional prototype/MVP. Add CI/CD as we go. Backend is priority and frontend can come later.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma 6 · PostgreSQL (Supabase) · Supabase Auth · Zod · Vitest · Vercel.

## Project structure

```
app/             Next.js App Router (pages + API routes)
components/ui/   UI components (shadcn-style)
hooks/           Reusable React hooks
lib/             Server-side library code (db, auth, audit, crypto, validators…)
prisma/          Schema, migrations, seed
public/assets/   Logos, favicons, integration icons
legacy-html/     Frozen pre-migration static site, for reference
```

## Deployment

Hosted on Vercel. Deploys are driven by Vercel's Git integration — push a branch and you get a preview URL; merge to the production branch and it ships to `synthforceai.com`. Database migrations are **not** auto-run on deploy; see CLAUDE.md → CI/CD for the manual flow.

PRs run lint + build via GitHub Actions (`.github/workflows/ci.yml`) before they can be merged.

## Contributing

Internal repo — open a PR against the branch you forked from (typically `nextjs-migration`), wait for CI green, then merge. See [CLAUDE.md](./CLAUDE.md) for conventions, branching model, and deeper context.

## Ownership

Proprietary. © SynthForce AI Inc. See `COPYRIGHT`.

- **Owner:** Samarth Kambli (samarth@synthforceai.com)
- **Founding Full-Stack Engineer:** Matthew Gomez-Morales (matthew@synthforceai.com)

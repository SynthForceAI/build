# Security Automation — MEMORIES

Running log for the weekly security sweep (branch `feat/security-updates` → PR to
`main`). Its purpose is to **prevent duplicate PRs**: before opening anything,
check this file. If an issue is already listed as *Fixed* or *Known / deferred*,
do **not** open another PR for it — extend the existing note instead.

No secrets, credentials, or key material are ever recorded here.

Severity scale: **L1** (low) · **L2** (moderate) · **L3** (critical).

---

## Fixed

### SEC-2026-08-02-01 — Cross-tenant foreign-key injection on write paths (L2, BOLA/IDOR)
- **Category:** Authentication & Authorization Flaws (multi-tenant isolation).
- **Status:** Fixed in this branch (`feat/security-updates`).
- **Where:**
  - `PATCH /api/agents/[id]` — `managedBy`, `departmentId`, `apiKeyId`
  - `PATCH /api/policies/[id]` — `scopeDepartmentId`
  - `POST /api/api-keys/connect` — `departmentId` (path **not** covered by the
    earlier PR #60)
- **Problem:** The create handlers validated that company-scoped FKs belong to
  the caller's company, but the update handlers and the connect flow did not.
  An authenticated user could re-point one of their own rows at another tenant's
  row and read it back through the response `include` relations. Highest impact:
  setting an agent's `managedBy` to a victim's user id leaks that user's
  `email` + `name` (cross-tenant PII) via the agent-detail `manager` relation.
  `departmentId`/`scopeDepartmentId` leak department names; `apiKeyId` links to
  another tenant's key row.
- **Fix:** Added `lib/tenant.ts` (`assertDepartmentInCompany`,
  `assertApiKeyInCompany`, `assertManagerInCompany`,
  `assertAgentReferencesInCompany`). Every guard is a no-op for absent ids and
  throws `ApiError(400)` with a stable code for a missing/foreign id (same 400
  either way — no existence oracle). Wired into the three vulnerable paths and
  refactored `POST /api/agents` + `POST /api/policies` to reuse it (DRY).
- **Tests:** `__tests__/lib/tenant.test.ts`,
  `__tests__/api/agents-fk-isolation.test.ts`,
  `__tests__/api/policies-fk-isolation.test.ts`,
  `__tests__/api/connect-department-isolation.test.ts`.
- **Relation to prior work:** PR **#60** ("block cross-tenant FK references on
  agent & policy PATCH routes") raised the PATCH subset but was **closed without
  merging**, so the hole was still live in `main`. This fix lands it with tests
  and additionally closes the connect-flow gap #60 missed. `providerId`/`modelId`
  are intentionally excluded — Provider/ProviderModel are global catalog tables.

---

## Known / deferred (do NOT open duplicate PRs)

### SEC-KNOWN-01 — Client-IP trust order in `lib/rate-limit.ts` (`getClientIp`)
- **Category:** Misconfiguration / API abuse. **Severity:** L1 on the current
  deployment.
- **Assessment:** `getClientIp` trusts the leftmost `x-forwarded-for`, then
  `x-real-ip`. Per Vercel docs, Vercel **overwrites** `x-forwarded-for` on a
  *direct* deployment to prevent spoofing, so the current behaviour is **safe as
  deployed**. It becomes a per-IP rate-limit bypass (brute-force on
  `/api/auth/login`, cost-amplification on the unauthenticated `/api/audits`)
  only if the app is ever fronted by another proxy/CDN or self-hosted.
- **Deferred:** Latent, not currently exploitable. If hardened later, prefer the
  platform-controlled `x-vercel-forwarded-for` header first. Do not ship as a
  "vulnerability" fix without that topology actually being in use.

### SEC-KNOWN-02 — Rate limiter is in-memory / per-instance
- `lib/rate-limit.ts` state is per function instance (documented in-file). On a
  horizontally-scaled fleet the effective limit is `limit × instances`. Needs a
  shared store (e.g. Upstash Redis) for a global guarantee. Infra change, not a
  code bug. Deferred.

### SEC-KNOWN-03 — Provider usage-sync incremental bugs — owned elsewhere
- Draft PRs **#85** (`anchor incremental sync window to lastSyncedAt`) and
  **#87** (`cap first-sync limit to 31 buckets`) from the *bug-management*
  automation already cover the `lib/providers/*-usage.ts` sync-window/limit
  issues. **Do not duplicate** — data-sync correctness is that automation's lane.

### SEC-KNOWN-04 — Pre-existing type errors in two test files
- `__tests__/api/insights.test.ts` and `__tests__/api/usage-summary.test.ts`
  cast `requireUser` mocks without `as unknown`, so `tsc --noEmit` reports errors
  there. Pre-exists on `main`; unrelated to security. Left untouched to keep this
  PR scoped. Trivial one-line fixes if a future run wants a clean typecheck.

---

## Reviewed and considered SAFE (as of 2026-08-02 sweep)

Recorded so future runs don't re-investigate from scratch:

- **Demo keys** (`sk-admin-demo` etc. in `lib/audit/demo-data.ts`) only return
  canned audit data; they grant no access to real data or elevated privileges.
- **Auth/crypto:** `lib/crypto.ts` (AES-256-GCM), `lib/report-token.ts`
  (constant-time compare), `proxy.ts`/`lib/supabase/*` all sound.
- **Billing self-grant** (`PATCH /api/companies/me`) and **cross-tenant export**
  (`/api/users/me/export`) — already fixed by merged PRs #59 and #65; verified
  intact.
- **Owner endpoints** (`/api/owner/*`, `/api/users`, `/api/activity-logs`) are
  `requireOwner`-gated. **LLM proxy** (`/api/proxy/...`) validates virtual keys,
  enforces policy, and pins the upstream origin. **Raw SQL** in
  insights/usage-summary is parameterized.

# Free Audit Engine — the cost-optimization wedge

**Status:** Live product surface. A customer connects a provider **admin/org key**
(OpenAI or Anthropic), SynthForce pulls org-level usage, runs deterministic
analysis plus six advanced telemetry insights, asks an LLM to write a plain-English
report, and renders the result at `/audit/free`. It is gated by the
**one-free-audit moat** (`lib/audit/quota.ts`) for free-tier companies.

The audit is the *wedge*: it shows a company what it is spending and where the
waste is, using data the provider already has, without installing anything. The
paid platform (the [proxy layer](./proxy-layer.md) and ongoing
[usage ingestion](./usage-ingestion.md)) then closes the attribution gap the audit
can only point at.

> **Audit vs. ongoing sync.** The audit is a one-shot 30-day pull that lives in
> `lib/audit/**`. It is deliberately separate from the incremental
> [usage-ingestion](./usage-ingestion.md) sync path (`lib/providers/**`,
> `lib/jobs/**`), which polls admin keys on a schedule. They share the pricing
> table (`lib/providers/pricing.ts`) and the `ProviderUsageReport` shape, nothing
> else.

---

## Where it lives

| Path | Responsibility |
|------|----------------|
| `lib/audit/run.ts` | Orchestrator. Loads the key, pulls usage, runs analysis, writes findings, marks the audit complete/failed. |
| `lib/audit/fetch-usage.ts` | Provider usage fetchers (OpenAI Usage+Costs API, Anthropic Usage Report API) → normalized `ProviderUsageReport`. |
| `lib/audit/engine.ts` | Pure deterministic analysis: findings, discovered agents, efficiency score, estimated waste. |
| `lib/audit/telemetry.ts` | Pure calculation of the six advanced insights. |
| `lib/audit/report.ts` | LLM prose report, with a deterministic template fallback. |
| `lib/audit/quota.ts` | The one-free-audit moat. Single source of truth for the limit. |
| `lib/audit/demo-data.ts` | Canned reports for demo keys (bypass real provider calls). |
| `app/api/api-keys/connect/route.ts` | **Primary entry point** — admin-key connect runs an inline audit. |
| `app/api/audits/route.ts` | Public, unauthenticated `POST /api/audits`. |
| `app/api/audits/[id]/route.ts` | `GET` a completed audit (auth, company-scoped). |
| `app/api/audits/[id]/rerun/route.ts` | Authenticated re-run (quota-gated). |
| `app/(dashboard)/audit/free/page.tsx` | The report UI (server component + section nav). |

Backing tables: `audits`, `audit_findings`, `discovered_agents`, `audit_raw_logs`
(see [Data model](#data-model) and `prisma/schema.prisma`). Shared type
`ProviderUsageReport` lives in `lib/providers/openai-billing.ts`.

---

## End-to-end flow

```
connect admin key ─▶ fetchAuditData ─▶ analyze() + calculateTelemetry()
  (or re-run)          (fetch-usage)      (engine + telemetry)
                            │                     │
                            ▼                     ▼
                     persist raw logs      generateReport() ── LLM or fallback
                            │                     │
                            └────────▶ persist Audit + findings + agents ─▶ /audit/free
```

`runAudit({ auditId, deleteKeyOnDone, periodDays })` in `lib/audit/run.ts` is the
spine. It runs **inline inside the request handler** (not a queue):

1. Load the audit with its `apiKey` + `provider`; reject if the key is missing or
   soft-deleted. Mark `status = "processing"`, set `startedAt`.
2. `fetchAuditData(provider.name, apiKey.encryptedKey, periodDays)` — decrypts the
   key and pulls usage from the matching provider (see below).
3. Persist raw responses to `audit_raw_logs` **first**, so a downstream failure
   still leaves a reproducible trace.
4. `analyze(usage)` → deterministic findings + top-line metrics.
5. `generateReport({ companyName, analysis })` → prose summary (LLM or fallback).
6. In one transaction: `createMany` findings, `createMany` discovered agents, and
   update the audit to `completed` with metrics + `reportData`.
7. If `deleteKeyOnDone`, soft-delete the `ApiKey` and zero its ciphertext.

On any throw, the audit is set to `status = "failed"` with a user-visible
`errorMessage`, and the error is re-raised to the caller.

> **Timeout budget.** Because step 2–6 run inline, the whole audit must finish
> within the platform function budget (`run.ts` notes ~10s Hobby / 60s Pro). Each
> provider `fetch` uses a **25s `AbortSignal.timeout`**. If audits start exceeding
> the limit, the documented next step is to move `runAudit` into a background queue
> or edge function — the orchestrator is already structured for it.

---

## Entry points (public interfaces)

There are three ways an audit is *created* (connect, public, re-run) and two
surfaces it is *read* from (the GET API and the report page).

### 1. Admin-key connect (primary, authenticated)

`POST /api/api-keys/connect` with `keyType: "admin"` and **no** `agentName`
(`ProviderConnectSchema` in `lib/validators/index.ts`):

1. `assertCanRunAudit(companyId)` up front — free-tier companies that already spent
   their run get **403** before any key is stored.
2. `verifyProviderKey` makes a real provider call to validate the key.
3. The key is encrypted (`lib/crypto.ts`), stored as an `ApiKey`, and (for admin
   keys) mirrored into `ProviderAdminKey` for future polling.
4. An `Audit` row is created and `runAudit(... deleteKeyOnDone: false ...)` runs
   inline. Response: `{ auditId }` (201). The client redirects to
   `/audit/free?id=<auditId>`.
5. If the inline audit throws, the key material is wiped (a "zombie" key) so the
   user can retry with the same key without tripping the duplicate check.

### 2. Public free audit (unauthenticated)

`POST /api/audits` with `{ apiKey, periodDays? }` (`AuditCreateSchema`):

- **No auth**, so it is strictly **rate-limited to 3 requests / IP / hour**
  (`rateLimitByIp`, scope `audits-create`) to prevent cost-amplification abuse.
- Runs under a sentinel company (`slug: "free-audit-system"`) + system user, and
  runs `runAudit(... deleteKeyOnDone: true ...)` so the pasted key is soft-deleted
  as soon as the audit completes.
- Returns `{ id, status, findings, discoveredAgents }`.

> Audits created this way belong to the sentinel company, and `GET /api/audits/:id`
> / the `/audit/free` page are **company-scoped** — so a public-endpoint audit is
> not viewable through the authenticated report page. The authenticated connect
> flow (path 1) is what the product UI actually uses.

### 3. Re-run (authenticated, quota-gated)

`POST /api/audits/:id/rerun` re-runs an existing audit for the **caller's own
company** (404 on mismatch, 400 if the key was revoked). It calls
`assertCanRunAudit` first, so a free-tier company cannot re-run. `periodDays` is
clamped to `1..90` (the UI sends `30`).

### 4. Read

- `GET /api/audits/:id` — auth required; `findFirst({ id, companyId })` so a
  mismatched or missing id returns the **same 404** (no id-existence leak). BigInt
  columns are stringified in the JSON.
- `app/(dashboard)/audit/free/page.tsx` — server component, also company-scoped.
  Renders three states: pending/processing ("Analyzing your spend…"), failed
  (shows `errorMessage`), completed (the full report).

All route handlers follow the App-Router convention of `params: Promise<{ id }>`
resolved with `await`, and the connect route is `dynamic = "force-dynamic"`.

---

## Provider fetchers (`fetch-usage.ts`)

`fetchAuditData` decrypts the key and dispatches by provider name. Only **openai**
and **anthropic** are supported; anything else throws a clear "not yet supported"
error. Both fetchers short-circuit to canned data for [demo keys](#demo-mode).

### OpenAI

Uses the **Organization Usage + Costs API** (requires an `sk-admin-` key with
*Read usage data* scope) — not the legacy dashboard billing endpoint.

- `GET /v1/organization/usage/completions` grouped by `model`, and
  `GET /v1/organization/costs` grouped by `project_id`.
- **31-bucket cap.** With `bucket_width=1d`, OpenAI returns at most 31 daily
  buckets per request. The period is split into ≤31-day chunks fetched **in
  parallel**, then merged.
- **Cost attribution.** For each day, the Costs-API dollar total is split across
  that day's models **proportionally by token share**. If the Costs API returns
  nothing for a day, cost falls back to the per-token estimate in
  `lib/providers/pricing.ts`.
- **Advanced telemetry** comes from three *extra* parallel fetches grouped by
  `project_id` (current + prior period for MoM), `batch`, and `api_key_id`. These
  need broader scopes; if any fails (403/404/parse), the field is silently left
  `undefined` and the **core audit still succeeds** — the UI then shows a
  "data unavailable" note for that section.

### Anthropic

Uses the **Org Usage Report API** (requires an `sk-ant-admin-` key).

- A single `GET /v1/organizations/usage_report/messages` call, `bucket_width=1d`,
  `group_by[]=api_key_id&group_by[]=model`. (The bracketed `group_by[]` params are
  built by hand — `URLSearchParams` would percent-encode the brackets, which
  Anthropic rejects.)
- **No Costs API**, so spend is always the per-token estimate from `pricing.ts`.
- `totalCalls` is `0` — the Anthropic usage API does not return request counts.
- Anthropic exposes **no** project / batch / per-key data, so those telemetry
  sections are always `null` (→ "data unavailable" in the UI).

Both fetchers translate HTTP failures into human-readable errors that surface on
the failed-audit screen: **401** (wrong key type), **403** (missing scope, with the
exact scope name to enable), **429** (rate limited).

---

## Deterministic analysis (`engine.ts`)

`analyze(report)` is pure (same input → same output, no I/O, no LLM). It produces
`findings`, `discoveredAgents`, and top-line metrics. Tunable thresholds are
constants at the top of the file.

| Finding `type` | Fires when | Severity | Savings? |
|----------------|-----------|----------|----------|
| `model_optimization` | Legacy GPT-4 (`gpt-4`, not `gpt-4o`) > **30%** of spend | `high` if > 60%, else `medium` | yes — the only contributor to `estimatedWaste` today |
| `cost_spike` | A day's spend > **2×** the period average | `high` if > 3 spikes, else `medium` | no |
| `spend_trend` | ≥ 14 days of data and 2nd-half vs 1st-half change > **±20%** | `high` if > +50% | no |
| `underuse` | Total spend is `> $0` but `< $10` for the period | `info` | no |

- **Efficiency score** = `100 − (estimatedWaste / totalSpend) × 100`, clamped
  0–100 (100 when there is no spend).
- **Discovered agents** are **one bucket per model**, not real agents (billing data
  can't resolve true per-agent detail). Each gets an `efficiencyRating`
  (`good`/`fair`/`poor`/`unknown`) from model class + spend share.

> The `FindingType` enum in the schema also has `idle_cost`, `provider_comparison`,
> and `benchmark`, which the engine does **not** emit yet. Don't assume every enum
> value appears in real data.

---

## Advanced telemetry (`telemetry.ts`)

`calculateTelemetry(report)` returns six insights. `null` means "not applicable /
data unavailable for this provider", which the report page renders as an explicit
note rather than hiding the section.

| Insight | Providers | What it flags |
|---------|-----------|---------------|
| `highVolumeProjects` | OpenAI | Projects taking a disproportionate spend share (top-20% & > 20% share = outlier), with MoM change. |
| `modelMismatch` | OpenAI + Anthropic | Flagship models doing short-output work (≥100 calls, avg output < 500 tokens) that a mini/haiku model could handle at 70–95% less. |
| `cacheEfficiency` | Anthropic only | Prompt-cache hit rate vs a 70% benchmark, with potential savings if < 50%. |
| `reasoningEfficiency` | OpenAI `o1`/`o3` only | Reasoning-to-output token ratio; > 10× suggests overthinking simple tasks. |
| `batchOpportunity` | OpenAI only | Realtime spend eligible for the 50%-off Batch API (eligible when > 500 calls & > $5). |
| `unusedKeys` | OpenAI only | API keys with zero calls in the window (dormant-credential risk). |

Telemetry is stored on the audit under `reportData.telemetry` and drives the
provider-specific sidebar sections on the report page.

---

## Report generation (`report.ts`)

`generateReport` asks an LLM for a short business-English report in a fixed
structure (Executive Summary / Key Findings / What to Do Next). The prompt enforces
**plain text only** — no markdown, no em-dashes, no emojis, exact dollar figures.

- Provider chosen by `AUDIT_AI_PROVIDER` (`openai` | `anthropic` | `deepseek`;
  DeepSeek uses the OpenAI-compatible surface). Model = `AUDIT_AI_MODEL`
  (default `gpt-4o-mini`). Credential = `AUDIT_AI_API_KEY`.
- **`AUDIT_AI_API_KEY` is optional.** If it is unset *or* the LLM call fails, a
  deterministic template report (`deterministicFallbackReport`) is returned, so
  audits always complete in dev/preview and never fail on an LLM outage.

---

## One-free-audit moat (`quota.ts`)

`quota.ts` is the single source of truth for the limit; both the API routes and the
report-page re-run control call into it so they can't disagree.

- Free tier gets **`FREE_AUDIT_LIMIT = 1`** audit total. `starter`, `team`, and
  `enterprise` are unlimited.
- **Counted statuses:** `pending`, `processing`, `completed`. `failed` and
  `cancelled` attempts **do not** burn the quota — a broken attempt should never
  cost a user their free run.
- `assertCanRunAudit(companyId)` throws `ApiError(403, "audit_limit_reached")` when
  exhausted; call it before creating any new audit.

> `subscriptionTier` is the paywall boundary and is intentionally **not** accepted
> by `CompanyUpdateSchema` (`.strict()`), so a company can't self-grant a paid tier.
> It changes only via the Stripe webhook, the seed, or a manual admin write.

---

## Demo mode

Fixed keys (`lib/audit/demo-data.ts`) return pre-built reports designed to light up
every product signal, without calling any provider — and, because
`verifyProviderKey` also short-circuits on them, bypassing key verification too:

- OpenAI: `sk-admin-demo`, `sk-admin-1234` → `$10,239.34`, 61% legacy GPT-4, spikes,
  a project outlier, batch opportunity, 2 unused keys.
- Anthropic: `sk-ant-admin-demo`, `sk-ant-admin-1234` → `$8,743.19`, opus/sonnet
  mismatches, an 8% cache hit rate. Project/batch/key sections are intentionally
  absent, exactly as a real Anthropic key behaves.

---

## Data model

| Table | Purpose |
|-------|---------|
| `audits` | One row per audit. Status, data window, top-line metrics, `reportData` (JSON), `reportSummary` (LLM prose), `errorMessage`. |
| `audit_findings` | Structured findings (type, severity, title, description, `potentialSavingsCents`, `orderHint`). |
| `discovered_agents` | Per-model buckets (name, model, cost/token totals, `efficiencyRating`). |
| `audit_raw_logs` | Raw provider responses kept for reproducibility. |

`AuditStatus` = `pending | processing | completed | failed | cancelled`.
`reportData` JSON shape written by `run.ts`:

```jsonc
{
  "byModel":         [{ "model": "...", "costCents": 0, "calls": 0, "tokensIn": 0, "tokensOut": 0, "tokensInCached": 0 }],
  "dailySpendCents": [{ "date": "YYYY-MM-DD", "costCents": 0, "calls": 0 }],
  "telemetry":       { /* TelemetryInsights, see telemetry.ts */ }
}
```

Money is stored as **integer cents in `BigInt`** columns and must be serialized to
strings before crossing to the client (`lib/serialize.ts`); the report page
converts with `Number(...)` for display math.

---

## The report page (`/audit/free`)

`/audit/free?id=<auditId>` is a company-scoped server component with section-based
navigation. `provider` (from `reportData.telemetry.provider`) decides which
sidebar sections exist:

- **Overview** (always): summary cards, "Your Synthetic Workforce" (per-model
  breakdown with inferred roles), Fleet Utilization, Fleet Performance Review, Burn
  Rate forecast, Key Findings, the LLM Analysis, and the "attribution gap" callout.
- **High-Volume Projects / Reasoning Efficiency / Batch Opportunity / Unused Keys**
  — OpenAI only.
- **Cache Efficiency** — Anthropic only.
- **Right Tool for the Job** (model mismatch) — both.

> Some overview cards (burn rate, spend trend, batch eligibility, spike/overtime
> detection) are **recomputed in the page** from `reportData.byModel` /
> `dailySpendCents`, separate from the persisted `findings`/`telemetry`. If you
> change a threshold, check whether it lives in `engine.ts`, `telemetry.ts`, **or**
> the page. The page also `redirect`s once to sync the applicable section ids into
> the `?sections=` query param.

The re-run control is swapped for an "Upgrade to re-run" link when
`getAuditQuota(companyId).canRun` is false.

---

## Configuration

| Env var | Used for | Notes |
|---------|----------|-------|
| `API_KEY_ENCRYPTION_KEY` | AES-256-GCM encrypt/decrypt of the pasted key | 32-byte base64. See `lib/crypto.ts`. |
| `AUDIT_AI_PROVIDER` | LLM report provider | `openai` (default) \| `anthropic` \| `deepseek`. |
| `AUDIT_AI_MODEL` | LLM report model | default `gpt-4o-mini`. |
| `AUDIT_AI_API_KEY` | LLM report credential | **optional** — falls back to a template report if unset. |

**Period.** `periodDays` defaults to 30 and the API accepts up to 90, but the
product UI (onboard form and re-run button) currently **hardcodes 30**.

---

## Constraints & gotchas

- **Admin/org keys only.** Audits need `sk-admin-…` (OpenAI) or `sk-ant-admin-…`
  (Anthropic) with usage-read scope. A normal `sk-…` project key returns 401/403.
- **OpenAI cost is a proportional estimate.** Daily Costs-API dollars are split
  across models by token share; only when the Costs API is empty does it fall back
  to the pricing table. Per-model cost is therefore an allocation, not a per-model
  invoice.
- **Anthropic has no cost or call counts.** Spend is always token-estimated and
  `totalCalls` is `0`; project/batch/key telemetry is always unavailable.
- **Telemetry degrades silently.** A key missing extra scopes yields `undefined`
  telemetry fields, not a failed audit. That is intentional.
- **Discovered agents ≠ managed agents.** They are model buckets for display; the
  full-platform `Agent` entity is unrelated.
- **`reportData` persists only the first OpenAI chunk's raw usage JSON**
  (`rawChunks[0]`), even though analysis merges all chunks — don't treat the raw log
  as the complete window for multi-chunk periods.
- **Legacy puller is dead code.** `fetchOpenAIUsage` / `normalizeOpenAI` in
  `lib/providers/openai-billing.ts` are **not** on the audit path (which uses
  `fetch-usage.ts`); that file is kept for the shared `ProviderUsageReport` type and
  `OpenAIPullerError`.
- **No dedicated unit tests** for `lib/audit/**` yet. The functions in `engine.ts`
  and `telemetry.ts` are pure and deterministic, so they are cheap to cover; nearby
  tests exist for `openai-usage`, `crypto`, and `rate-limit`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Audit fails with "rejected the admin key (401)" | Project key, not an admin key | Use an `sk-admin-…` / `sk-ant-admin-…` key. |
| Fails with "lacks usage API access (403)" | Admin key missing *Read usage data* scope | Enable the scope in the provider console. |
| Report shows `$0.00` spend | No usage in the window, or Costs API empty + token estimate near zero | Confirm the org actually spent in the last 30 days. |
| Telemetry sections show "data unavailable" | Key lacks extra scopes, or provider is Anthropic | Broaden OpenAI scopes; Anthropic simply doesn't expose these. |
| "You've used your free audit" (403) | Free tier already has a counted audit | Upgrade the tier, or (dev) mark the prior audit `failed`/`cancelled`. |
| Audit stuck on "Analyzing…" | Inline run exceeded the function budget | Shorten the window / move `runAudit` to a queue (see [flow](#end-to-end-flow)). |

---

## Related

- [usage-ingestion.md](./usage-ingestion.md) — the ongoing, incremental sync path
  (admin-key polling + agent self-report) that powers the full dashboard.
- [proxy-layer.md](./proxy-layer.md) — the real-time gateway that closes the
  per-request attribution gap the audit can only flag.
- [architecture.md](./architecture.md) — platform-wide data model (note:
  `prisma/schema.prisma` is the source of truth).
- [CLAUDE.md](./CLAUDE.md) — repo conventions, commands, and gotchas.

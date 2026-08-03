# Free Audit Engine — How SynthForce Turns a Provider Key into a Cost Report

The free "agent audit" is SynthForce's wedge product: a customer hands us a
read-only provider **admin key**, we pull ~30 days of org-level usage, run
deterministic analysis, ask an LLM to write it up in plain English, and show a
cost-optimization report. It shares the platform's database and code surface but
is otherwise self-contained under `lib/audit/**`.

This doc covers the engine itself. For how *ongoing* usage data enters the
platform after onboarding, see [usage-ingestion.md](./usage-ingestion.md); this
audit is a **one-shot pull**, separate from the incremental sync job.

---

## The pipeline at a glance

```
entry point ──▶ runAudit(auditId) ──▶ fetchAuditData ──▶ analyze ──▶ generateReport ──▶ persist ──▶ results page
                (lib/audit/run.ts)     (fetch-usage.ts)   (engine.ts)  (report.ts)      (Prisma)     (/audit/*)
                                             │                │
                                       demo-data.ts     telemetry.ts
```

| File | Role |
|------|------|
| `lib/audit/run.ts` | Orchestrator. Loads the key, drives the pipeline, writes results, marks status. |
| `lib/audit/fetch-usage.ts` | One-shot pull from a provider's org usage/cost API → normalized `ProviderUsageReport`. |
| `lib/audit/engine.ts` | Pure deterministic analysis → findings, discovered agents, top-line metrics. |
| `lib/audit/telemetry.ts` | Pure advanced insights (model mismatch, cache, batch, unused keys, project outliers). |
| `lib/audit/report.ts` | Turns the analysis into a prose report via LLM, with a deterministic fallback. |
| `lib/audit/demo-data.ts` | Canned reports for demo keys — no live API calls. |
| `lib/audit/quota.ts` | The "one free audit" moat (free-tier gate). |
| `lib/providers/openai-billing.ts` | Defines the shared `ProviderUsageReport` shape + `OpenAIPullerError`. |

Data model (`prisma/schema.prisma`): `Audit` (the run + top-line metrics +
`reportSummary`/`reportData`), `AuditFinding`, `DiscoveredAgent`, `AuditRawLog`
(raw provider responses kept for reproducibility). Status lives on the
`AuditStatus` enum: `pending → processing → completed | failed | cancelled`.

---

## Entry points

There are two ways an audit is created; both call the same `runAudit`.

### 1. Public free-audit tool — `POST /api/audits`

`app/api/audits/route.ts`. **Unauthenticated** on purpose (it's the public
lead-gen tool), so it is guarded hard:

- **Rate limit:** 3 requests per IP per hour (`rateLimitByIp`), because it runs
  an expensive inline provider-poll + LLM job and would otherwise be a
  cost-amplification / DoS vector.
- Body is `AuditCreateSchema`: `apiKey` (raw, ≤ 500 chars) and optional
  `periodDays` (1–90, default 30).
- It attaches the run to a singleton **`free-audit-system`** company + a sentinel
  system user (created on first use), encrypts the key, then runs the audit
  inline with **`deleteKeyOnDone: true`** so the customer key is wiped once the
  report exists.
- Returns `{ id, status, findings, discoveredAgents }` immediately so the caller
  can render or poll.

### 2. Authenticated onboard / dashboard

Driven by the Onboard `ProviderForm`, which `POST`s to
`/api/api-keys/connect` with `keyType: "admin"` and **no** `agentName`. That's
the "run a free audit" branch of the connect flow
(see [usage-ingestion.md](./usage-ingestion.md#the-connect-flow)):

1. `assertCanRunAudit` gates free-tier companies *before* the key is verified or
   stored.
2. The key is verified, encrypted, stored, and upserted as a `ProviderAdminKey`.
3. A `pending` `Audit` is created and `runAudit` runs inline with
   **`deleteKeyOnDone: false`** (the key is kept for the platform).
4. Response is `{ auditId }`; the client redirects to `/audit/free?id=<auditId>`.

**Re-run:** `POST /api/audits/:id/rerun` (`requireUser`, company-scoped) re-runs
against the *same* stored key. It re-checks `assertCanRunAudit`, so free-tier
companies can't re-run once they've spent their single audit.

> On a failed run, both authenticated paths soft-delete the key and drop the
> `ProviderAdminKey` so the customer can retry with the same key without tripping
> the duplicate-key check (the "zombie key" cleanup).

---

## `runAudit` — the orchestrator

`lib/audit/run.ts`. Runs **inline inside the POST handler** today. The code notes
the exit ramp: if runs start exceeding the Vercel function timeout, move this to
a background queue / Edge Function. Sequence:

1. Load the `Audit` + its `apiKey` + provider. Reject if the key is missing or
   already soft-deleted.
2. Flip status to `processing`, stamp `startedAt`.
3. `fetchAuditData(provider, encryptedKey, periodDays)` → `ProviderUsageReport`.
4. Persist `AuditRawLog` rows **first**, so a downstream failure still leaves a
   reproducible trace.
5. `analyze(usage)` → findings + discovered agents + metrics (pure, no I/O).
6. `generateReport(...)` → prose summary (LLM or fallback).
7. In **one transaction**: write `AuditFinding[]`, `DiscoveredAgent[]`, and
   update the `Audit` to `completed` with metrics, `reportSummary`, and
   `reportData` (`{ byModel, dailySpendCents, telemetry }`).
8. If `deleteKeyOnDone`, soft-delete the `ApiKey` **and zero out
   `encryptedKey`** — the key material is no longer recoverable.

Any throw → the audit is marked `failed` with a user-visible `errorMessage`
(provider errors surface their own message, e.g. the 401/403/429 strings below).

---

## Fetching usage (`fetch-usage.ts`)

`fetchAuditData` decrypts the key and dispatches by provider. **Only `openai`
and `anthropic` are supported**; anything else throws a clear "not yet
supported" error. Both return the same normalized `ProviderUsageReport`.

### OpenAI

Uses the Organization endpoints (both require an **`sk-admin-`** key with "read
usage" scope):

- `GET /v1/organization/usage/completions` — token + request counts, `group_by=model`.
- `GET /v1/organization/costs` — **actual billed USD**, `group_by=project_id`.

Key behaviors, verified against the code:

- **31-bucket cap → chunking.** The Usage/Costs APIs hard-cap at 31 daily buckets
  per request (`bucket_width=1d`, `limit=31`). The fetcher splits the window into
  ≤ 31-day chunks and fetches them in parallel, then merges. (It does **not**
  page via `next_page`; the chunk + limit strategy covers the ≤ 90-day window.)
- **Cost is the source of truth, tokens are the fallback.** Per day, the billed
  USD from the Costs API is distributed across that day's models **in proportion
  to each model's token share**. Only when a day has no cost data does it fall
  back to token-based pricing (`lib/providers/pricing.ts`).
- **Advanced telemetry is best-effort.** Three extra parallel fetches
  (`group_by` = `project_id` current + prior period, `batch`, `api_key_id`) feed
  the telemetry sections. They need extra scopes; **any failure is swallowed**
  (the whole block is wrapped in try/catch returning `{}`) so the core audit
  still completes. Missing data surfaces as "unavailable" in the UI, not an error.
- All fetches use a 25s `AbortSignal.timeout`.

### Anthropic

`GET /v1/organizations/usage_report/messages` with an **`sk-ant-admin-`** key
(`anthropic-version: 2023-06-01`), `group_by[]=api_key_id&group_by[]=model`.

- The bracketed `group_by[]` params are appended **as literal brackets** —
  `URLSearchParams` would percent-encode them and Anthropic rejects that.
- Anthropic's usage report returns **no cost and no request counts**, so cost is
  always estimated from tokens via `pricing.ts` and `totalCalls` is `0`. Input
  tokens fold in cache-creation and cache-read tokens; `tokensInCached` tracks
  cache reads (used by the cache-efficiency insight).

### Provider error surface (both)

`401` → wrong key type / not an admin key · `403` → key lacks usage/org scope ·
`429` → rate-limited. These strings become the audit's `errorMessage`.

---

## Deterministic analysis (`engine.ts`)

`analyze(report)` is **pure** — same input, same output, no I/O, no LLM. It emits
`findings`, `discoveredAgents`, and top-line metrics. Rule constants are tunable
at the top of the file:

| Finding (`type`) | Fires when | Notes |
|------------------|-----------|-------|
| `model_optimization` | Legacy GPT-4 (`gpt-4`, not `gpt-4o`) > **30%** of spend | Estimates savings from swapping ~66% of GPT-4 to `gpt-4o-mini` (~16× cheaper input). Severity `high` above 60% share. This is the **only** finding that currently feeds `estimatedWasteCents`. |
| `cost_spike` | A day > **2×** the period's daily average | Reports the worst day + multiple. `high` if > 3 spikes. |
| `spend_trend` | Needs ≥ 14 days; second half vs first differs > **20%** | `high` above 50%. Up = accelerating, down = confirm it's intentional. |
| `underuse` | Total spend in `(0, $10)` | Informational — leverage is in *using* agents, not trimming cost. |

**Metrics:** `efficiencyScore = clamp(0..100, 100 − waste/spend × 100)`
(100 when there's no spend). `discoveredAgents` are **not real agents** — each is
one model bucket, rated `good` / `fair` / `poor` / `unknown` by model class and
spend share. Aggregate billing data can't resolve true per-agent detail; this
caveat is shared with the `DiscoveredAgent` note in the data model.

### Advanced telemetry (`telemetry.ts`)

`calculateTelemetry(report)` adds deeper, also-pure insights. Each returns `null`
when its input data is absent (so the UI can say "unavailable"):

| Insight | Provider | Fires / meaning |
|---------|----------|-----------------|
| `modelMismatch` | both | Model with ≥ 100 calls and avg output < 500 tokens → suggests a cheaper model. Only kept if savings > $1/mo. Confidence rises when avg output < 200. |
| `cacheEfficiency` | Anthropic | Cache-read tokens ÷ input tokens vs a 70% benchmark; flags headroom below 50%. |
| `reasoningEfficiency` | OpenAI `o1`/`o3` | Reasoning-to-output token ratio; recommends GPT-4o when > 10×. |
| `batchOpportunity` | OpenAI | Estimates savings from moving realtime → Batch API (50% off × ~60% eligible). |
| `unusedKeys` | OpenAI | Per-key activity; flags keys with 0 calls. |
| `highVolumeProjects` | OpenAI | Per-project spend share + MoM change; marks top-20% / >20%-share projects as outliers. |

---

## Report generation (`report.ts`)

`generateReport({ companyName, analysis })` produces the plain-English summary
stored as `Audit.reportSummary`.

- **LLM is optional.** With no `AUDIT_AI_API_KEY`, or if the LLM call throws, it
  returns `deterministicFallbackReport(...)` so audits always complete in
  dev/preview.
- **Provider-agnostic.** `AUDIT_AI_PROVIDER` = `openai` | `anthropic` |
  `deepseek` (DeepSeek uses the OpenAI-compatible surface at
  `api.deepseek.com/v1`). Cheap models are recommended (`AUDIT_AI_MODEL` default
  `gpt-4o-mini`). Calls use `temperature 0.3`, `max_tokens 800`, 25s timeout.
- **Strict output style** enforced in the prompt: plain text only — no markdown,
  no `#`/`*`/backticks, **no em-dashes**, no emojis, exact dollar figures, and a
  fixed three-section structure (Executive Summary / Key Findings / What to Do
  Next) ending on a fixed upsell line.

> This is SynthForce's **own** key, distinct from the customer key being audited.
> The customer key is only ever used for the usage/cost pulls in `fetch-usage.ts`.

---

## Demo mode (`demo-data.ts`)

For sales demos and previews without a real provider key. Four canned keys return
a hand-built `ProviderUsageReport` and **skip all live API calls**:

| Key | Provider | Scenario |
|-----|----------|----------|
| `sk-admin-demo`, `sk-admin-1234` | OpenAI | ~$10,239 spend; 60% legacy GPT-4 (HIGH model_optimization + a single mismatch flag), +70% trend, 2 spikes, a project outlier, batch opportunity, 2 unused keys. |
| `sk-ant-admin-demo`, `sk-ant-admin-1234` | Anthropic | ~$8,743 spend; opus/sonnet mismatches, 8% cache hit rate (concern), +78% trend, 2 spikes; no project/batch/key data (matches Anthropic's real API surface). |

Demo keys also **bypass verification** in `verifyProviderKey`
(`lib/providers/index.ts`) — they return a canned model list instead of calling
the provider — so the whole connect → audit path works end-to-end offline. The
demo dataset is tuned so every finding, telemetry section, and the burn-rate card
light up.

---

## The "one free audit" moat (`quota.ts`)

`quota.ts` is the single source of truth for the limit; both API routes
(enforcement) and the results page (UI gating) call it so they can't disagree.

- Free tier gets **exactly one** audit that "counts" — only `pending`,
  `processing`, and `completed` consume quota. `failed` / `cancelled` attempts do
  **not** burn it, so a broken run never costs the user their free audit.
- `starter` / `team` / `enterprise` are unlimited.
- `assertCanRunAudit(companyId)` throws `403 audit_limit_reached` when exhausted;
  `getAuditQuota(companyId)` returns `{ tier, limit, used, remaining, canRun }`
  for the UI.

---

## Viewing results

Server components render the stored `Audit`:

- `app/(dashboard)/audit/free/page.tsx` — `/audit/free?id=<auditId>` (the onboard
  redirect target; also shows quota state).
- `app/(dashboard)/audit/[id]/page.tsx` — `/audit/<id>`.

Both read `reportData.telemetry`, `findings`, and `discoveredAgents` and render
the model breakdown, findings list, discovered-agent cards, the burn-rate
projection (`BurnRateCard`), and the telemetry sections. `GET /api/audits/:id`
exposes the same data as JSON, company-scoped (a missing/foreign audit returns
the same `404` so ids can't be probed). `BigInt` cent fields are serialized to
strings.

---

## Environment variables

| Var | Needed for |
|-----|------------|
| `API_KEY_ENCRYPTION_KEY` | Encrypt/decrypt the audited provider key (32-byte base64). |
| `AUDIT_AI_PROVIDER` | Report LLM provider: `openai` (default) / `anthropic` / `deepseek`. |
| `AUDIT_AI_MODEL` | Report model (default `gpt-4o-mini`). |
| `AUDIT_AI_API_KEY` | SynthForce's LLM key. **Optional** — omit to use the deterministic fallback report. |
| `DATABASE_URL` / `DIRECT_URL` | Prisma (audit rows + raw logs). |

Full validation lives in `lib/env.ts`.

---

## Constraints & gotchas

- **Admin keys only.** OpenAI needs an `sk-admin-` key (Usage + Costs); Anthropic
  needs an `sk-ant-admin-` key. Personal keys 401/403 on the org endpoints.
- **Runs inline** in the request handler. Long windows (up to 90 days = 3 chunked
  OpenAI fetches + telemetry + LLM) can approach the function timeout; that's the
  documented trigger to move to a queue.
- **Cost precision differs by provider.** OpenAI numbers are anchored to real
  billed USD; Anthropic numbers are token-estimated (`pricing.ts` is a coarse,
  hand-maintained table, not a billing source of truth).
- **`estimatedWasteCents` today reflects only `model_optimization`.** Other
  findings are informational and don't move the efficiency score.
- **`DiscoveredAgent` ≠ agent.** It's a per-model bucket; billing data can't
  attribute to a real agent.

## Troubleshooting

- **Audit `failed` with a 401/403 message** → wrong key type or missing usage
  scope. Re-connect an admin key with usage-read access.
- **`audit_limit_reached` (403)** → free tier already used its one audit; upgrade
  or use a paid-tier company. Failed attempts don't count — check the audit's
  status if a "used" audit looks like it shouldn't count.
- **Report reads like a template / no LLM polish** → `AUDIT_AI_API_KEY` is unset
  or the LLM call failed; the deterministic fallback was used (check logs for
  `[audit] report LLM failed`).
- **Telemetry sections say "unavailable"** → expected for Anthropic (no
  project/batch/key data) or when the OpenAI key lacks scope for the extra
  fetches; the core audit still succeeds.
- **Want a report with no real key** → use a demo key (`sk-admin-demo`, etc.).

---

## Related

- [usage-ingestion.md](./usage-ingestion.md) — the ongoing sync path and the full connect flow.
- [proxy-layer.md](./proxy-layer.md) — the real-time agent gateway.
- [architecture.md](./architecture.md) — platform-wide data model.
- [CLAUDE.md](./CLAUDE.md) — repo conventions and commands.

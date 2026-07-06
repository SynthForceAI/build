# Usage Ingestion — How Spend & Token Data Enters SynthForce

SynthForce records what each agent costs so the dashboards, budgets, and audits
have something to show. Usage data arrives through **three independent paths**:

| Path | Trigger | Writes to | Doc |
|------|---------|-----------|-----|
| **A. Proxy** | Agent routes live traffic through SynthForce | `usage_logs` (managed `Agent`) | [proxy-layer.md](./proxy-layer.md) |
| **B. Admin-key polling** | Scheduled / on-demand pull from a provider's org usage API | `connected_agent_usage_logs` | this doc |
| **C. Agent self-report** | Agent POSTs its own token counts | `connected_agent_usage_logs` | this doc |

Paths B and C feed **`ConnectedAgent`** (the onboarding entity). Path A feeds the
managed **`Agent`**. See [Data model cheat-sheet](#data-model-cheat-sheet) for why
those are different tables.

This doc covers B and C plus the **connect flow** that sets them up. The proxy
(path A) has its own doc.

---

## The connect flow

Everything starts at `POST /api/api-keys/connect`
(`app/api/api-keys/connect/route.ts`), driven by the Onboard page. Body is
validated by `ProviderConnectSchema` (`lib/validators/index.ts`):
`providerId`, `apiKey`, optional `label` / `agentName` / `departmentId`,
`keyType` (`"personal"` | `"admin"`, default personal), `periodDays` (≤ 90).

The handler branches on `keyType` and whether an `agentName` was given:

1. **Quota gate (admin + no agent name only).** This is the "run a free audit"
   path; `assertCanRunAudit` (`lib/audit/quota.ts`) blocks free-tier companies
   that already used their one free audit *before* any key is verified or stored.
2. **Verify the key for real.** `verifyProviderKey` (`lib/providers/index.ts`)
   makes a live call to the provider and returns the available model list. A
   failure → `400 key_verification_failed`.
3. **Encrypt & store.** The raw key is AES-256-GCM encrypted (`lib/crypto.ts`)
   into an `ApiKey` row. `keyIdentifier` keeps only the last 4 chars for display.
   Duplicate live keys → `409`. "Zombie" keys left by a failed audit are cleaned
   up so the user can retry.
4. **Admin keys also become a polling key.** When `keyType = "admin"`, the same
   encrypted key is upserted into `ProviderAdminKey` (one per company+provider) so
   the polling job (path B) can use it.
5. **Branch:**
   - **Admin + no agent name →** create a `pending` `Audit`, run it inline
     (`runAudit`), return `{ auditId }`. (See the audit lifecycle comment in
     `prisma/schema.prisma` and `lib/audit/`.)
   - **Otherwise →** create a `ConnectedAgent` (+ a managed `Agent` shell) with a
     freshly generated **self-report token** (path C), returned **once** as
     `reportToken`.
6. **Immediate backfill (admin keys).** After creating the agent, the handler
   triggers an inline `syncProviderUsage` so the dashboard shows ~30 days of real
   history immediately instead of waiting for the next cron run. For Anthropic it
   first resolves the key's `api_key_id` so usage can be attributed per-agent
   (stored in `ConnectedAgent.metadata`).

---

## Path B — Admin-key polling

Pulls org-level usage from each provider's billing/usage API using the stored
`ProviderAdminKey`, normalizes it, and attributes it to connected agents.

### Pieces

| Path | Role |
|------|------|
| `app/api/jobs/sync-provider-usage/route.ts` | Cron entrypoint. Bearer-auth with `SYNC_JOB_SECRET`; `maxDuration = 300`. |
| `lib/jobs/sync-provider-usage.ts` | Fan-out: iterate every `ProviderAdminKey`, partial-failure tolerant. |
| `lib/providers/sync-dispatch.ts` | Map `Provider.name` → its sync implementation. |
| `lib/providers/openai-usage.ts` | OpenAI usage + costs pull. |
| `lib/providers/anthropic-usage.ts`, `deepseek-usage.ts`, `vertex-usage.ts` | Other providers. |
| `lib/providers/usage-sync.ts` | Shared `persistBuckets` — attribution, dedupe, counters. |
| `app/api/providers/[providerId]/admin-key/route.ts` | Store / delete an admin key (owner/admin). |
| `app/api/providers/[providerId]/sync-usage/route.ts` | On-demand sync (owner/admin). |

### How a provider sync works (OpenAI example)

`syncOpenAIUsage` hits two org endpoints (both require an **`sk-admin-`** key):

- `GET /v1/organization/usage/completions` → token + request counts.
- `GET /v1/organization/costs` → **actual billed USD** per day per project.

Key behaviors:

- **Cost source of truth is the Costs API.** Token-based pricing (`pricing.ts`) is
  only a fallback for recent buckets the Costs API hasn't surfaced yet (it can lag
  ~2 hours). Daily costs are distributed across same-(project, day) buckets in
  proportion to each bucket's token share.
- **Sync window.** First sync (when `lastSyncedAt` is null) backfills **30 days**
  in daily buckets. Later syncs anchor to `lastSyncedAt − 15 min` (a safety
  buffer), choosing `1m` granularity for short spans and `1h` for longer ones.
- **Cadence-independent.** Because every sync re-reads from a buffered start and
  rows dedupe (below), no usage is lost even though GitHub Actions fires the cron
  irregularly (~60–90 min in practice despite a 5-minute schedule).

### Attribution & dedupe (`persistBuckets`)

`persistBuckets` (`lib/providers/usage-sync.ts`) takes `NormalizedBucket[]` and:

1. Loads non-deleted `ConnectedAgent`s for the company+provider, oldest first.
2. **Attributes each bucket** via `pickAgent`: if the bucket's `attributionKey`
   (e.g. OpenAI `project_id` / `api_key_id`) matches a value in some agent's
   `metadata`, use that agent; otherwise fall back to the **earliest-connected**
   agent for the provider.
3. **Writes** a `ConnectedAgentUsageLog` (`source = provider_sync`). The unique
   index `(connectedAgentId, providerApiId)` dedupes repeated polls — a duplicate
   raises Prisma `P2002`, which is caught and skipped (no double counting).
4. **Bumps counters** on the agent (`totalTokensIn/Out`, `totalCostCents`,
   `monthlySpendCents`, `tasksMonitored`, `lastSyncedAt`, `lastActiveAt`) and flips
   `pending → active` on first usage.

> **Attribution limitation.** Provider usage APIs aggregate by org / project / key,
> not by SynthForce's notion of an "agent." When several agents share one provider
> key and a bucket can't be matched by identifier, usage lands on the
> earliest-connected agent. This mirrors the `DiscoveredAgent` caveat in the audit
> engine — billing data alone can't resolve a true per-agent breakdown.

### Runbook

**Scheduled (production):** `.github/workflows/sync-provider-usage.yml` curls
`POST /api/jobs/sync-provider-usage` with `Authorization: Bearer <SYNC_JOB_SECRET>`.
It runs on a `*/5 * * * *` cron, after every successful **Deploy to Vercel** run,
and on manual dispatch. Required repo secrets: `SYNTHFORCE_API_URL` and
`SYNC_JOB_SECRET` (the latter must equal the Vercel env var of the same name; the
route **fails closed** if it's unset or mismatched).

**On-demand (single provider):** `GET /api/providers/:providerId/sync-usage`
(owner/admin) runs the same dispatch for one provider's admin key.

**Manual trigger via curl:**

```bash
curl -fsS -X POST "$SYNTHFORCE_API_URL/api/jobs/sync-provider-usage" \
  -H "Authorization: Bearer $SYNC_JOB_SECRET" \
  -H "Content-Type: application/json"
```

The job returns a summary: `adminKeysProcessed`, `logsCreated`,
`agentsActivated`, and per-provider `failures` (one failure never aborts the rest).

---

## Path C — Agent self-report

For agents that can't (or don't want to) route through the proxy, but can POST
their own usage after each task.

- **Endpoint:** `POST /api/connected-agents/:id/report-usage`
  (`app/api/connected-agents/[id]/report-usage/route.ts`). `:id` is a
  `ConnectedAgent` id.
- **Auth:** the per-agent **report token** issued at connect time, sent as
  `Authorization: Bearer sfr_…`. Only the token's SHA-256 hash is stored
  (`ConnectedAgent.reportTokenHash`); the route hashes the presented token and
  does a constant-time compare (`lib/report-token.ts`). A bad token or unknown
  agent returns the **same 403**, so agent ids can't be probed.
- **Rate limit:** 600 requests/min per IP (`lib/rate-limit.ts`), enough for
  ~10 req/s sustained.
- **Body:** `UsageReportSchema` — `tokensIn`, `tokensOut` (at least one > 0),
  optional `cost` (cents; omit to let the server estimate via `pricing.ts`),
  `model`, `endpoint`, `statusCode`, `durationMs`, `metadata`.
- **Effect:** writes a `ConnectedAgentUsageLog` (`source = self_report`), bumps the
  same rolling counters as path B, and flips `pending → active` on the first
  successful report.

```bash
curl -X POST "$SYNTHFORCE_API_URL/api/connected-agents/$AGENT_ID/report-usage" \
  -H "Authorization: Bearer $SF_REPORT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tokensIn": 1200, "tokensOut": 350, "model": "gpt-4o-mini"}'
```

> Self-reports have no `providerApiId`, so they never collide on the dedupe index
> (Postgres treats NULLs as distinct). The server trusts self-reported numbers —
> that's the trade-off for not proxying traffic.

---

## Cost estimation (`lib/providers/pricing.ts`)

When a usage event has no provider-reported cost, `calculateCostCents` estimates
it from token counts:

- Pricing is **USD per 1,000,000 tokens**, keyed by provider then by a model-id
  **prefix**; the **longest matching prefix wins** (so `gpt-4o-mini` beats
  `gpt-4o`).
- An unknown provider returns **0** — callers treat 0 as "unknown," not "free."
- It's a deliberately coarse, hand-maintained table — a sanity estimate, not a
  billing source of truth. Provider-reported costs (path B) take precedence.

---

## Data model cheat-sheet

| Model | What it represents | Populated by |
|-------|--------------------|--------------|
| `ApiKey` | An encrypted customer provider key. | Connect flow. |
| `ProviderAdminKey` | Org/admin key for polling a provider's usage API (1 per company+provider). | Connect (admin) / admin-key route. |
| `ConnectedAgent` | An agent created via Onboard; the unit usage is attributed to in paths B & C. | Connect flow. |
| `ConnectedAgentUsageLog` | Per-event usage for a `ConnectedAgent`. Deduped on `(connectedAgentId, providerApiId)`. | Paths B & C. |
| `Agent` | The full-platform managed agent (budgets, policies, proxy). | Connect flow (shell) / platform CRUD. |
| `UsageLog` | Per-request usage for a managed `Agent`. | Path A (proxy). |
| `DiscoveredAgent` | A model-level bucket inferred from a free audit (not a real agent). | Audit engine. |

`ConnectedAgent` and `Agent` are intentionally separate: usage APIs and audits can
only resolve to coarse buckets, so onboarding/polling data lives on
`ConnectedAgent` and never bloats the hot `usage_logs` table or fights its
required `agent_id` FK.

---

## Environment variables

| Var | Needed for |
|-----|------------|
| `API_KEY_ENCRYPTION_KEY` | Encrypt/decrypt all stored provider & admin keys (32-byte base64). |
| `SYNC_JOB_SECRET` | Auth for the cron sync endpoint (also a GitHub repo secret). |
| `DATABASE_URL` / `DIRECT_URL` | Prisma (pooled app connection / direct for migrations). |
| `AUDIT_AI_*` | The audit report LLM (connect's free-audit branch). |

Full validation lives in `lib/env.ts`.

---

## Troubleshooting

- **`401` from OpenAI sync** → the stored key isn't an `sk-admin-` key with usage
  read access. Re-connect with an admin key.
- **`admin_key_not_configured` on `/sync-usage`** → no `ProviderAdminKey` for that
  provider; POST one to `/admin-key` (or re-connect an admin key) first.
- **Usage all lands on one agent** → expected when agents share a provider key and
  buckets carry no matching identifier. See the attribution limitation above.
- **Cron not firing on time** → GitHub Actions cron is best-effort; the sync window
  buffer + dedupe make this safe. Use the on-demand endpoint to force a pull.
- **Sync endpoint returns `401`** → `SYNC_JOB_SECRET` missing or mismatched between
  the GitHub secret and the Vercel env var.

---

## Related

- [proxy-layer.md](./proxy-layer.md) — path A (real-time proxy).
- [architecture.md](./architecture.md) — platform data model and design.
- [CLAUDE.md](./CLAUDE.md) — repo conventions and commands.

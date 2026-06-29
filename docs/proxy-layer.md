# Proxy Layer — Real-time Agent Gateway

**Status:** Phase 2 of the full platform. The request path, virtual-key lookup,
policy engine, and usage logging are implemented and unit-tested
(`__tests__/lib/proxy/**`). Customer-facing **key issuance is not yet wired to a
route** — see [Current state & gaps](#current-state--gaps).

The proxy is how SynthForce sees and controls agent traffic in real time. An
agent swaps its real provider key for a SynthForce **virtual key** and points its
base URL at the proxy. Every request then flows through SynthForce, which
identifies the agent, enforces policy, forwards to the provider, and logs token
usage and cost — without the agent code changing anything but two values.

This is the paid "real-time control" tier. The lighter-weight ingestion paths
(admin-key polling and agent self-report) are documented in
[usage-ingestion.md](./usage-ingestion.md).

---

## Where it lives

| Path | Responsibility |
|------|----------------|
| `app/api/proxy/[provider]/[...path]/route.ts` | HTTP entrypoint. One handler for GET/POST/PUT/PATCH/DELETE. |
| `lib/proxy/router.ts` | Orchestrates a request: identify → enforce → forward. |
| `lib/proxy/virtual-keys.ts` | Generate / look up / rotate / revoke virtual keys. |
| `lib/proxy/middleware/identify-agent.ts` | Resolve `Authorization: Bearer sf-key-…` to an agent context. |
| `lib/proxy/middleware/enforce-policy.ts` | Thin wrapper that throws on a policy block. |
| `lib/proxy/policy-engine.ts` | Evaluate a request against the agent's assigned policies. |
| `lib/proxy/middleware/log-response.ts` | Fire-and-forget usage logging (incl. SSE streams). |
| `lib/providers/pricing.ts` | Per-token cost estimate when the provider response omits a price. |

Backing tables: `agent_virtual_keys`, `agents`, `policies`, `policy_assignments`,
`usage_logs` (see `prisma/schema.prisma`).

---

## Request lifecycle

For a call to `…/api/proxy/{provider}/{path}`
(`routeProxyRequest` in `lib/proxy/router.ts`):

1. **Identify the agent.** `identifyAgent` strips the `Bearer ` prefix and calls
   `lookupVirtualKey`. A missing/unknown/inactive key → **401**. On success it
   returns an `AgentContext` (agent id, company id, provider, decrypted real key,
   a generated `requestId`, and a start `timestamp`).
2. **Match the provider.** The virtual key's provider must equal the `{provider}`
   path segment, else **400 `provider_mismatch`**. The provider must have an
   `apiBaseUrl` configured, else **500 `provider_misconfigured`**.
3. **Buffer the body once.** The raw bytes are read to text so they can be both
   parsed (for policy checks / model extraction) and forwarded verbatim. Non-JSON
   bodies are forwarded as-is.
4. **Enforce policy.** `enforcePolicy` runs **before** any upstream call. A block
   throws `ApiError` with the policy's status code (403 / 429). See
   [Policy enforcement](#policy-enforcement).
5. **Build the upstream URL & headers.** `buildUpstreamUrl` rejects path traversal
   and cross-origin escapes (see [Security](#security-constraints)). Headers are
   rebuilt from an allowlist plus the injected real provider credential.
6. **Forward.** `fetch(url, …)` with a **120s timeout** (`AbortSignal.timeout`).
7. **Stream back.** A curated set of response headers is copied, the response is
   `clone()`d for logging, and `response.body` is streamed straight through a
   `NextResponse` — unmodified, so both JSON and SSE (`text/event-stream`) work.
8. **Log usage (async).** `logProxyResponse(response.clone(), …)` is
   fire-and-forget; logging never delays or breaks the proxied response.

The route exports `dynamic = "force-dynamic"` so it always runs at request time
and is never cached.

---

## Virtual keys

A virtual key is the only credential the agent holds. The real provider key is
encrypted and stored alongside it; the agent never sees it again.

- **Format:** `sf-key-` + 16 random bytes hex (`generateVirtualKey`). Shown to the
  customer once; only the row (with the encrypted provider key) is persisted.
- **Storage:** `AgentVirtualKey` (`agent_virtual_keys`). `id` is a `cuid()`;
  `encryptedProviderKey` uses the same AES-256-GCM scheme as customer keys
  (`lib/crypto.ts`, `API_KEY_ENCRYPTION_KEY`).
- **Lookup:** `lookupVirtualKey` returns `null` for any key that isn't
  `sf-key-…`, doesn't exist, or is inactive. It also bumps `lastUsedAt`
  asynchronously (best-effort, never blocks the request).
- **Rotation:** `rotateVirtualKey` mints a new key for the same agent/provider
  (re-using the decrypted provider key) and deactivates the old one
  (`isActive = false`, `rotatedAt = now`).
- **Revocation:** `revokeVirtualKey` flips `isActive = false`.

`GET /api/agents/:id/virtual-key` returns the agent's current active key
(owning company only). The UI surfaces it via `components/ui/virtual-key-display.tsx`.

### Customer integration

The dashboard instructs customers to set the virtual key as their provider key
and point the base URL at `https://synthforce.ai/api/proxy/{provider}`:

```bash
# OpenAI-compatible client
export OPENAI_API_KEY="sf-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export OPENAI_BASE_URL="https://synthforce.ai/api/proxy/openai"
```

```bash
curl https://synthforce.ai/api/proxy/openai/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'
```

**Path math matters.** The upstream URL is `provider.apiBaseUrl + path`, where
`path` is everything after `/api/proxy/{provider}`. The seeded OpenAI and
Anthropic base URLs *already include* `/v1` (e.g. `https://api.openai.com/v1`), so
send the path **after** `/v1` — the example above resolves to
`https://api.openai.com/v1/chat/completions`. The `{provider}` segment must match
the virtual key's provider (`openai`, `anthropic`, …), or the request is rejected
with `provider_mismatch`.

---

## Policy enforcement

`checkAgentPolicy` (`lib/proxy/policy-engine.ts`) loads the agent with its
`policyAssignments`, then:

1. **Kill switch (agent status).** If `agent.status !== "active"` (paused /
   deactivated / flagged), **all** requests are blocked with **403**.
2. **Per-policy evaluation.** For each *active assigned* policy with
   `severity = "block"`, every rule is checked. Non-`block` severities
   (`warning` / `flag` / `log`) are observational and never stop a request.

A policy's `ruleDefinition` is read as an **array of `{ type, value }` rules**.
If it isn't an array, the policy is skipped (treated as allow).

| Rule `type` | `value` shape | Effect when violated |
|-------------|---------------|----------------------|
| `KILL_SWITCH` | `boolean` | `false` → block (403). |
| `MODEL_WHITELIST` | `string[]` | Request `model` not in list → block (403). No model in body → allowed. |
| `MODEL_BLACKLIST` | `string[]` | Request `model` in list → block (403). |
| `SPEND_CAP_MONTHLY` | `number` (cents) | Month-to-date `usage_logs.cost_cents` for the agent ≥ cap → block (403). |
| `RATE_LIMIT` | `{ requestsPerMinute: number }` | Over the limit → block (429). In-memory counter (see below). |
| `DATA_ACCESS` | `string[]` | A pattern appears (case-insensitive) in the JSON body → block (403). |

Unknown rule types fail open (allowed). The rate-limit rule counts **synchronously
at check time** (before the upstream call) via `lib/rate-limit.ts`, so it holds
under concurrent bursts — but the counter is **per function instance**, not a
globally-consistent fleet-wide limit (swap in a shared store like Redis for that).

> **Important — two policy formats currently coexist.** The public
> `POST /api/policies` API validates `ruleDefinition` with `PolicyRuleSchema`
> (`lib/validators/index.ts`): a **single object** with types `budget`,
> `rate_limit`, `time_restriction`, `content_guard`, `model_restriction`,
> `department_isolation`. The proxy engine above expects an **array** of the
> `KILL_SWITCH` / `MODEL_*` / `SPEND_CAP_MONTHLY` / `RATE_LIMIT` / `DATA_ACCESS`
> rules. These two vocabularies have **not been reconciled**, and there is no API
> that writes `PolicyAssignment` rows yet. In practice a policy authored through
> the public API is therefore not enforced by the proxy today. Treat the table
> above as the source of truth for *what the proxy actually enforces*, and plan to
> unify the two formats (and add an assignment endpoint) before policies created
> in the product take effect on live traffic.

---

## Usage logging

`logProxyResponse` (`lib/proxy/middleware/log-response.ts`) reads the cloned
response and writes one `UsageLog` row per request:

- **Token extraction.**
  - Non-streaming JSON: reads `usage.prompt_tokens` / `completion_tokens`
    (OpenAI) and `usage.input_tokens` / `output_tokens` (Anthropic).
  - Streaming SSE: `parseStreamingUsage` scans every `data:` event and takes the
    **max** seen per direction (handles OpenAI's final-chunk usage and
    Anthropic's split `message_start` / `message_delta` usage).
  - Falls back to a rough char-based estimate (`bodyLength / 4`) for input tokens
    when the provider reports none.
- **Cost.** `calculateCostCents(provider, model, tokensIn, tokensOut)` using the
  hardcoded per-million pricing table in `lib/providers/pricing.ts`.
- **Row written:** `companyId`, `agentId`, `providerId`, token counts, `costCents`,
  `durationMs` (now − request start), `statusCode`, and
  `metadata = { model, streaming, requestId }`.
- **Failure isolation.** Any error is caught and logged; logging never throws into
  the request path.

> Prompt/response text is **not** logged here. Capturing full content is gated by
> `Agent.logFullContent` (default off) — see `prisma/schema.prisma`.

---

## Security constraints

- **Virtual key never reveals the provider key.** The real key is decrypted only
  in memory to build the upstream `Authorization` / `x-api-key` header.
- **SSRF / path guard.** `buildUpstreamUrl` rejects `..`, control characters and
  backslashes, and verifies the resolved URL's origin equals the provider's
  configured `apiBaseUrl` origin. A crafted path can't redirect the request to a
  different host.
- **Header allowlist (request).** Only `content-type`, `accept`,
  `anthropic-version`, `anthropic-beta`, `openai-beta`, and `x-request-id` are
  forwarded upstream. The incoming `Authorization` (virtual key), `Cookie`,
  `Host`, etc. are dropped; the correct provider credential is injected instead.
  Anthropic uses `x-api-key` and defaults `anthropic-version: 2023-06-01`.
- **Header allowlist (response).** Only `content-type`, `x-request-id`, and the
  provider rate-limit headers are passed back to the caller.
- **Fail-closed auth, fail-open on misconfig.** Unknown keys are rejected (401);
  unknown *rule types* are allowed (so a typo can't silently brick all traffic).

---

## Current state & gaps

- **No key issuance endpoint.** `generateVirtualKey` exists and is tested, but no
  route or UI action calls it yet. `GET /api/agents/:id/virtual-key` only *reads*
  an existing active key. Keys must currently be created out-of-band.
- **Policy wiring incomplete.** The public policy format and the enforced format
  differ, and nothing assigns policies to agents (no `PolicyAssignment` writer).
  See the callout in [Policy enforcement](#policy-enforcement).
- **Rate limiting is per-instance.** Acceptable for abuse protection; not a
  globally-exact cap. `lib/rate-limit.ts` documents the Redis swap path.
- **Cost is an estimate.** `pricing.ts` is a coarse, manually-maintained table.
  Reconcile against provider-reported costs (the polling job already does this for
  OpenAI — see [usage-ingestion.md](./usage-ingestion.md)).

---

## Related

- [usage-ingestion.md](./usage-ingestion.md) — admin-key polling and agent
  self-report (the non-proxy ways usage data enters SynthForce).
- [architecture.md](./architecture.md) — platform-wide data model and design.
- [CLAUDE.md](./CLAUDE.md) — repo conventions and commands.

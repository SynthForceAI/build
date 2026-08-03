# Billing, Subscription Tiers & Upgrades

How SynthForce models paid plans, lets customers **request** an upgrade, and
gates features by a company's `subscriptionTier`. The Stripe integration is
**scaffolded but inert** — everything runs in "request upgrade" mode today.

## Status

- **No live payments yet.** Clicking upgrade records interest; the team
  provisions the plan by hand. The Stripe path is stubbed behind a single switch
  (`isStripeEnabled()`) and stays dormant until the `STRIPE_*` env vars are set.
- **`subscriptionTier` is the paywall boundary.** A customer can never set it on
  their own company — only a platform owner or the (future) Stripe webhook can.
- **What the tier actually gates today** is the free-audit quota
  (`lib/audit/quota.ts`): `free` = one audit, paid tiers = unlimited. Most other
  plan bullet points are marketing copy, not yet code-enforced (see
  [Constraints](#constraints--gotchas)).

## Where it lives

| Path | Role |
|------|------|
| `lib/billing/plans.ts` | The plan catalog (copy, prices, features) + tier ranking. Source of truth for the UI. |
| `lib/billing/config.ts` | Stripe on/off switch, tier → Price-ID map, checkout return URLs. |
| `lib/billing/provider.ts` | The upgrade seam: `startUpgrade`, `recordUpgradeRequest`, the Stripe-checkout stub, Stripe-customer-id storage, reserved-settings guard, and `applyTierFromWebhook`. |
| `app/api/billing/upgrade-request/route.ts` | `POST` — a customer begins an upgrade. |
| `app/api/billing/upgrade-request/[id]/route.ts` | `PATCH` — an owner updates a request's status. |
| `app/api/billing/webhook/route.ts` | Stripe webhook seam (inert: returns 503/501). |
| `app/api/owner/users/[userId]/tier/route.ts` | `PATCH` — an owner sets a company's tier directly. |
| `app/(dashboard)/U/billing/**` | Customer billing page + `PlanGrid`. |
| `app/owner/users/page.tsx`, `components/owner/UpgradeRequestsTable.tsx` | Owner dashboard: view + action upgrade requests. |
| `lib/audit/quota.ts` | Where a tier is actually enforced today (audit quota). |

## Data model

- **`Company.subscriptionTier`** — `SubscriptionTier` enum
  (`free` | `starter` | `team` | `enterprise`, default `free`).
- **`Company.settings`** (Json) — a free-form bag that also holds the billing
  seam's Stripe linkage (`stripeCustomerId`, `stripeSubscriptionId`). These keys
  are **reserved** and stripped from any user-supplied settings update.
- **`UpgradeRequest`** — one row per "Request upgrade" click:
  `{ userId, companyId, email, tier, status }`. `status` is the
  `UpgradeRequestStatus` enum: `pending` → `contacted` → `converted` → `closed`.

## The plans (`plans.ts`)

| Tier | Price | CTA | Notes |
|------|-------|-----|-------|
| `free` | $0 | Current plan | One free audit + full report. |
| `starter` | $49/mo | Request upgrade | Unlimited + re-runnable audits, history. `featured`. |
| `team` | $199/mo | Request upgrade | Departments, budgets, alerts, policies, RBAC. |
| `enterprise` | Custom | Contact sales | Real-time proxy, spend caps, SSO. `contactSales` → mailto, no request row. |

`TIER_RANK` (`free 0 → enterprise 3`) drives `isUpgrade(from, to)`, which the UI
uses to decide which cards render an actionable CTA. `planForTier(tier)` resolves
a tier to its plan (falling back to `free`).

## Upgrade lifecycle (customer)

1. **`/U/billing`** (`page.tsx`, server component, redirects to `/login` if
   unauthenticated) shows the current plan, the audit quota usage
   (`getAuditQuota`), and the `PlanGrid`.
2. The customer clicks the CTA on an **upgradeable** plan. `PlanGrid` (client)
   `POST`s `{ tier }` to `/api/billing/upgrade-request`. Enterprise instead opens
   a `mailto:` to sales and never calls the API.
3. The route runs `requireUser`, an IP rate limit (**10/hr**, scope
   `billing-upgrade`), and Zod validation (`starter | team | enterprise`), then
   calls `startUpgrade(user, tier)`.
4. **`startUpgrade` branches** (`provider.ts`):
   - **Stripe enabled *and* a Price ID exists →** `startStripeCheckout` →
     `{ kind: "checkout", url }` → route returns `{ ok, checkoutUrl }` → client
     redirects to Stripe.
   - **Otherwise (default) →** `recordUpgradeRequest` writes an `UpgradeRequest`
     (status `pending`) → route returns `{ ok: true }` → the card flips to
     "Request received".
5. **`subscriptionTier` is not touched here** — deliberately, so a free user
   can't self-grant a paid tier and bypass the audit quota.

> The Stripe return URLs (`/U/billing?upgrade=success|cancelled`) render banners
> on the billing page. They only fire once real checkout is wired.

## Owner side

The owner dashboard (`app/owner/users/page.tsx`) is gated by `isOwner(...)`
(non-owners are redirected to `/U`). It reads the pending-request count and
recent `UpgradeRequest` rows and renders them via `UpgradeRequestsTable`. Owners
have two levers:

- **`PATCH /api/billing/upgrade-request/:id`** (`requireOwner`) — move a request
  through `pending | contacted | converted | closed`.
- **`PATCH /api/owner/users/:userId/tier`** (`requireOwner`) — set the target
  user's **company** `subscriptionTier` to any of `free | starter | team |
  enterprise`. This is the manual "provision the plan" step.

> Marking a request `converted` and changing the tier are **two independent
> actions** — there is no automatic link. An owner does both.

## Who can change `subscriptionTier` (the paywall boundary)

Only these paths write the tier:

1. **Platform owner** — `PATCH /api/owner/users/:userId/tier` (`requireOwner`).
2. **Stripe webhook** — `applyTierFromWebhook(companyId, tier)` (once live).
3. **Seed / manual DB** edits.

It is **not** writable by customers. `PATCH /api/companies/me`
(`CompanyUpdateSchema`) accepts only `name`, `slug`, and `settings` — there is no
`subscriptionTier` field. Settings writes are additionally passed through
`stripReservedBillingKeys`, so a caller can neither clobber their own Stripe
linkage nor forge someone else's `stripeCustomerId`. This is covered by
`__tests__/lib/billing/reserved-settings.test.ts`.

**Owner identity:** `requireOwner` allows the primary owner (`OWNER_EMAIL` in
`lib/constants.ts`) plus any user with `isPlatformOwner = true`.

## The Stripe seam (future)

Everything needed to switch payments on is scaffolded so no UI/route changes are
required later — callers only read `isStripeEnabled()` and the price map.

- `isStripeEnabled()` = `!!STRIPE_SECRET_KEY`.
- `priceIdForTier(tier)` → `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_TEAM`; `null`
  for `free`/`enterprise` (free has no price, enterprise is sales-led).
- `checkoutReturnUrls()` → `/U/billing?upgrade=success|cancelled`.
- The Stripe customer/subscription ids live in `Company.settings` (no migration
  needed) via `get/setStripeCustomerId`.
- The webhook must verify the signature against the **raw** body (`req.text()`,
  not `req.json()`), then call `applyTierFromWebhook`.

Activation checklist lives at the top of `lib/billing/provider.ts` and
`app/api/billing/webhook/route.ts`.

## Environment variables

| Var | Needed for |
|-----|------------|
| `STRIPE_SECRET_KEY` | Flips the app into Stripe mode. Absent = request-upgrade mode. |
| `STRIPE_WEBHOOK_SECRET` | Verifying webhook signatures (future). |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_TEAM` | Map paid tiers to Stripe Prices. |
| `NEXT_PUBLIC_APP_URL` | Base for checkout return URLs. |

All are optional and validated in `lib/env.ts`.

## Constraints & gotchas

- **Provisioning is manual.** In request-upgrade mode a tier only changes when an
  owner sets it. Customers see "Request received", not an instant upgrade.
- **Don't half-configure Stripe.** `startStripeCheckout` is a stub that *throws*.
  If `STRIPE_SECRET_KEY` **and** a Price ID are set but the stub isn't
  implemented, `startUpgrade` routes to it and the upgrade request 500s. Leave
  the Price IDs unset until the checkout body is implemented.
- **Webhook is inert:** `503 billing_disabled` when Stripe is off, `501
  not_implemented` when on-but-unimplemented.
- **Tier is company-scoped, not per-user.** The owner tier route resolves the
  target user's company and updates *that company* — every member is affected.
- **Feature bullets ≠ enforcement.** Only the audit quota is gated by tier today.
  Departments/policies/proxy features listed on paid plans are enforced (or not)
  by their own subsystems — see [proxy-layer.md](./proxy-layer.md) and
  [usage-ingestion.md](./usage-ingestion.md). `subscriptionTier` is also read
  (not gated) to label spend benchmarks in `app/api/companies/me/insights`.

## Troubleshooting

- **"Request received" but my plan didn't change** → expected in request-upgrade
  mode; an owner provisions it via the owner tier route.
- **`upgrade-request` 500s with "startStripeCheckout() is not yet implemented"**
  → Stripe key + a Price ID are set without a real checkout body. Unset the Price
  ID (falls back to recording a request) or implement the stub.
- **Customer can't set their tier in settings** → by design; `subscriptionTier`
  isn't in `CompanyUpdateSchema`. Use the billing page (request) or an owner.
- **`403 owner_only` on `/api/owner/**`** → caller isn't `OWNER_EMAIL` and lacks
  `isPlatformOwner`. Non-owners hitting `/owner` are redirected to `/U`.
- **`429` on upgrade** → the 10/hr per-IP limit on `/api/billing/upgrade-request`.

## Related

- [usage-ingestion.md](./usage-ingestion.md) — usage/spend data (the audit quota,
  gated by tier, is the main paid feature today).
- [architecture.md](./architecture.md) — platform-wide data model.
- [CLAUDE.md](./CLAUDE.md) — repo conventions, commands, and the paywall note.

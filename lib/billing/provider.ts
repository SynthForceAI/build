/**
 * Billing provider seam.
 *
 * `startUpgrade()` is the single entry point the API route calls. It returns a
 * discriminated result so the client can either redirect to Stripe Checkout
 * (future) or show a "we'll be in touch" confirmation (today). When Stripe is
 * wired, only the `startStripeCheckout()` stub below needs a real body — the
 * route and UI already handle both result shapes.
 *
 * Stripe integration checklist (future):
 *   1. `npm i stripe`
 *   2. Set STRIPE_SECRET_KEY + STRIPE_PRICE_* env vars (see lib/env.ts).
 *   3. Implement `startStripeCheckout()` using stripe.checkout.sessions.create
 *      with the price id from `priceIdForTier(tier)` and the URLs from
 *      `checkoutReturnUrls()`. Persist the Stripe customer id via
 *      `setStripeCustomerId()` so it can be reused.
 *   4. Implement the webhook at app/api/billing/webhook/route.ts to flip
 *      `company.subscriptionTier` on checkout.session.completed /
 *      customer.subscription.updated|deleted (use `applyTierFromWebhook`).
 */
import { prisma } from "../db";
import type { SubscriptionTier, User, Prisma } from "@prisma/client";
import { isStripeEnabled, priceIdForTier } from "./config";

export type PaidTier = Extract<SubscriptionTier, "starter" | "team" | "enterprise">;

export type UpgradeResult =
  /** Stripe path: redirect the browser to this hosted checkout URL. */
  | { kind: "checkout"; url: string }
  /** Manual path: interest recorded, team follows up. */
  | { kind: "request_recorded" };

/**
 * Begin an upgrade to `tier` for the given user's company. Routes through
 * Stripe when configured, otherwise records the request for manual follow-up.
 */
export async function startUpgrade(user: User, tier: PaidTier): Promise<UpgradeResult> {
  if (isStripeEnabled() && priceIdForTier(tier)) {
    return startStripeCheckout(user, tier);
  }
  await recordUpgradeRequest(user, tier);
  return { kind: "request_recorded" };
}

/** Logs the customer's interest so the team can reach out and provision. */
async function recordUpgradeRequest(user: User, tier: PaidTier): Promise<void> {
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "upgrade_requested",
      metadata: { tier, companyId: user.companyId },
    },
  });
}

/**
 * STUB — not yet implemented. Guarded by `isStripeEnabled()` so it never runs
 * until STRIPE_SECRET_KEY is set. See the checklist at the top of this file.
 */
async function startStripeCheckout(_user: User, _tier: PaidTier): Promise<UpgradeResult> {
  throw new Error(
    "Stripe checkout is configured (STRIPE_SECRET_KEY set) but startStripeCheckout() " +
    "is not yet implemented. See lib/billing/provider.ts.",
  );
}

// ---------------------------------------------------------------------------
// Stripe customer id storage
//
// We stash the Stripe customer id in Company.settings (an existing Json column)
// so adding Stripe needs no schema migration. If/when billing grows, promote
// these to dedicated `stripe_customer_id` / `stripe_subscription_id` columns.
// ---------------------------------------------------------------------------

type BillingSettings = { stripeCustomerId?: string; stripeSubscriptionId?: string };

/**
 * Keys inside `Company.settings` that are owned by the billing system. They
 * link a company to its Stripe customer/subscription and gate paid access, so
 * they must never be writable through user-facing settings updates (a customer
 * could otherwise wipe their own billing linkage or point it at someone else's
 * Stripe customer). Only the billing seam here writes them.
 */
export const RESERVED_BILLING_SETTINGS_KEYS: readonly string[] = [
  "stripeCustomerId",
  "stripeSubscriptionId",
];

/**
 * Return a copy of a user-supplied settings object with all billing-owned keys
 * removed. Use before persisting settings that originate from a request body.
 */
export function stripReservedBillingKeys(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (RESERVED_BILLING_SETTINGS_KEYS.includes(key)) continue;
    clean[key] = value;
  }
  return clean;
}

export async function getStripeCustomerId(companyId: string): Promise<string | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const settings = (company?.settings as BillingSettings | null) ?? {};
  return settings.stripeCustomerId ?? null;
}

export async function setStripeCustomerId(companyId: string, stripeCustomerId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const settings = (company?.settings as BillingSettings | null) ?? {};
  await prisma.company.update({
    where: { id: companyId },
    data: { settings: { ...settings, stripeCustomerId } as Prisma.InputJsonValue },
  });
}

/**
 * Apply a tier change coming from a verified Stripe webhook. Kept here so the
 * webhook route stays thin and the tier-write logic lives with the rest of the
 * billing seam.
 */
export async function applyTierFromWebhook(companyId: string, tier: SubscriptionTier): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: { subscriptionTier: tier },
  });
}

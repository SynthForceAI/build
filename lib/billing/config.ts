/**
 * Billing configuration — the seam between plans and the (future) Stripe
 * integration.
 *
 * Today the app runs in "request upgrade" mode: clicking upgrade records
 * interest and the team provisions the plan manually. To switch on real
 * payments later, set the STRIPE_* env vars (see lib/env.ts) and implement
 * the Stripe branch in lib/billing/provider.ts. Nothing else in the UI or
 * routes needs to change — they all read `isStripeEnabled()` and the price
 * map from here.
 */
import { env } from "../env";
import type { SubscriptionTier } from "@prisma/client";

/**
 * True once a Stripe secret key is configured. Used to decide between the
 * checkout flow and the manual "request upgrade" flow. The single switch the
 * rest of the codebase reads — keep all Stripe-enabled checks pointed here.
 */
export function isStripeEnabled(): boolean {
  return !!env().STRIPE_SECRET_KEY;
}

/**
 * Maps a paid tier to its configured Stripe Price ID, or null when unset.
 * Free/enterprise return null (free has no price; enterprise is sales-led).
 */
export function priceIdForTier(tier: SubscriptionTier): string | null {
  const e = env();
  switch (tier) {
    case "starter": return e.STRIPE_PRICE_STARTER ?? null;
    case "team":    return e.STRIPE_PRICE_TEAM ?? null;
    default:        return null;
  }
}

/**
 * Where the customer is sent back to after a Stripe Checkout session. Kept
 * here so the success/cancel URLs are defined once.
 */
export function checkoutReturnUrls(): { successUrl: string; cancelUrl: string } {
  const base = env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    successUrl: `${base}/U/billing?upgrade=success`,
    cancelUrl:  `${base}/U/billing?upgrade=cancelled`,
  };
}

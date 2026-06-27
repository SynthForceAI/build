/**
 * Subscription plan catalog — the single source of truth for billing copy.
 *
 * Prices here are placeholders for the pre-launch product. They feed the
 * /U/billing page and are intentionally kept in one spot so they can be
 * swapped for real Stripe Price IDs later without touching the UI.
 *
 * `tier` maps 1:1 to the Prisma `SubscriptionTier` enum.
 */
import type { SubscriptionTier } from "@prisma/client";

export type Plan = {
  tier: SubscriptionTier;
  name: string;
  /** Display price, e.g. "$49" or "Custom". */
  price: string;
  /** Billing cadence suffix, e.g. "/mo". Empty for custom/free. */
  cadence: string;
  tagline: string;
  features: string[];
  /** Highlight as the recommended plan. */
  featured?: boolean;
  /** CTA label shown when this plan is an available upgrade. */
  cta: string;
  /** Custom plans route to sales instead of the in-app upgrade request. */
  contactSales?: boolean;
};

export const PLANS: Plan[] = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    cadence: "",
    tagline: "See where your AI spend is leaking — once.",
    features: [
      "One free spending audit",
      "Full audit report & findings",
      "Model-by-model breakdown",
      "Efficiency score & savings estimate",
    ],
    cta: "Current plan",
  },
  {
    tier: "starter",
    name: "Starter",
    price: "$49",
    cadence: "/mo",
    tagline: "Re-run audits whenever you want and keep a history.",
    features: [
      "Unlimited spending audits",
      "Re-run any audit on demand",
      "Full audit history",
      "Weekly email digests",
      "Up to 5 connected providers",
    ],
    featured: true,
    cta: "Request upgrade",
  },
  {
    tier: "team",
    name: "Team",
    price: "$199",
    cadence: "/mo",
    tagline: "Budgets, departments, and guardrails for a growing fleet.",
    features: [
      "Everything in Starter",
      "Departments & per-team budgets",
      "Budget alerts & anomaly detection",
      "Policies & guardrails",
      "Role-based access for your team",
    ],
    cta: "Request upgrade",
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    tagline: "Real-time control with the SynthForce proxy layer.",
    features: [
      "Everything in Team",
      "Real-time proxy: per-request cost tracking",
      "Spend caps & approval gates",
      "SSO & priority support",
      "Unlimited agents & providers",
    ],
    cta: "Contact sales",
    contactSales: true,
  },
];

/** Rank used to decide which plans are "upgrades" relative to the current one. */
const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  team: 2,
  enterprise: 3,
};

export function planForTier(tier: SubscriptionTier): Plan {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

export function isUpgrade(from: SubscriptionTier, to: SubscriptionTier): boolean {
  return TIER_RANK[to] > TIER_RANK[from];
}

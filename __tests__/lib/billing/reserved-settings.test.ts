/**
 * stripReservedBillingKeys / RESERVED_BILLING_SETTINGS_KEYS.
 *
 * Company.settings is a free-form JSON bag, but the billing seam stashes the
 * Stripe customer/subscription linkage in it. Those keys must never be writable
 * from a user-supplied settings payload, or a customer could wipe their own
 * billing linkage or point it at another company's Stripe customer. This helper
 * is the chokepoint that strips them.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: () => ({
    API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64"),
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  }),
}));

// provider.ts imports prisma transitively; we never touch the DB in these tests.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  RESERVED_BILLING_SETTINGS_KEYS,
  stripReservedBillingKeys,
} from "@/lib/billing/provider";

afterEach(() => vi.clearAllMocks());

describe("RESERVED_BILLING_SETTINGS_KEYS", () => {
  it("covers the Stripe linkage keys", () => {
    expect(RESERVED_BILLING_SETTINGS_KEYS).toContain("stripeCustomerId");
    expect(RESERVED_BILLING_SETTINGS_KEYS).toContain("stripeSubscriptionId");
  });
});

describe("stripReservedBillingKeys", () => {
  it("removes stripeCustomerId", () => {
    const out = stripReservedBillingKeys({ stripeCustomerId: "cus_attacker", theme: "dark" });
    expect(out).toEqual({ theme: "dark" });
    expect("stripeCustomerId" in out).toBe(false);
  });

  it("removes stripeSubscriptionId", () => {
    const out = stripReservedBillingKeys({ stripeSubscriptionId: "sub_evil", locale: "en" });
    expect(out).toEqual({ locale: "en" });
  });

  it("removes every reserved key at once while keeping the rest", () => {
    const out = stripReservedBillingKeys({
      stripeCustomerId: "cus_x",
      stripeSubscriptionId: "sub_x",
      theme: "dark",
      notifications: true,
    });
    expect(out).toEqual({ theme: "dark", notifications: true });
  });

  it("returns an empty object when only reserved keys are present", () => {
    const out = stripReservedBillingKeys({ stripeCustomerId: "cus_x", stripeSubscriptionId: "sub_x" });
    expect(out).toEqual({});
  });

  it("returns an empty object for empty input", () => {
    expect(stripReservedBillingKeys({})).toEqual({});
  });

  it("passes through a payload with no reserved keys unchanged", () => {
    const input = { theme: "light", currency: "USD", nested: { a: 1 } };
    expect(stripReservedBillingKeys(input)).toEqual(input);
  });

  it("does not mutate the input object", () => {
    const input = { stripeCustomerId: "cus_x", theme: "dark" };
    const snapshot = { ...input };
    stripReservedBillingKeys(input);
    expect(input).toEqual(snapshot);
  });

  it("is exact-match (case-sensitive): a differently-cased key is not stripped", () => {
    const out = stripReservedBillingKeys({ StripeCustomerId: "cus_x" });
    expect(out).toEqual({ StripeCustomerId: "cus_x" });
  });
});

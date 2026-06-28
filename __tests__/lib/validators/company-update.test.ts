/**
 * CompanyUpdateSchema — guards the user-facing PATCH /api/companies/me payload.
 *
 * The security-critical property: `subscriptionTier` is NOT an accepted field,
 * so a company can never self-grant a paid tier (which would bypass the
 * one-free-audit moat). The schema is `.strict()`, so any attempt to smuggle it
 * in is rejected outright with a validation error rather than silently ignored.
 */
import { describe, expect, it } from "vitest";
import { CompanyUpdateSchema } from "@/lib/validators";

describe("CompanyUpdateSchema — subscriptionTier is not user-settable", () => {
  it("rejects a body that sets subscriptionTier alone", () => {
    const result = CompanyUpdateSchema.safeParse({ subscriptionTier: "enterprise" });
    expect(result.success).toBe(false);
  });

  it("rejects subscriptionTier smuggled alongside a valid field", () => {
    const result = CompanyUpdateSchema.safeParse({ name: "Acme", subscriptionTier: "team" });
    expect(result.success).toBe(false);
  });

  it.each(["free", "starter", "team", "enterprise"])(
    "rejects subscriptionTier=%s for every tier value",
    (tier) => {
      const result = CompanyUpdateSchema.safeParse({ subscriptionTier: tier });
      expect(result.success).toBe(false);
    },
  );

  it("does not expose subscriptionTier on the parsed output type", () => {
    const result = CompanyUpdateSchema.safeParse({ name: "Acme" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("subscriptionTier" in result.data).toBe(false);
    }
  });
});

describe("CompanyUpdateSchema — accepted fields still work", () => {
  it("accepts a name-only update", () => {
    const result = CompanyUpdateSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts a kebab-case slug", () => {
    const result = CompanyUpdateSchema.safeParse({ slug: "acme-inc" });
    expect(result.success).toBe(true);
  });

  it("accepts a free-form settings object", () => {
    const result = CompanyUpdateSchema.safeParse({ settings: { theme: "dark" } });
    expect(result.success).toBe(true);
  });
});

describe("CompanyUpdateSchema — defensive validation", () => {
  it("rejects an empty body (at least one field required)", () => {
    const result = CompanyUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys via the strict schema", () => {
    const result = CompanyUpdateSchema.safeParse({ name: "Acme", hacker: true });
    expect(result.success).toBe(false);
  });

  it("rejects a non-kebab-case slug", () => {
    const result = CompanyUpdateSchema.safeParse({ slug: "Bad Slug" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = CompanyUpdateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

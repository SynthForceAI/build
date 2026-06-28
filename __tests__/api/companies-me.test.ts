/**
 * PATCH /api/companies/me — access-control + billing-bypass regression tests.
 *
 * Background: every self-signup user is the "owner" of their own workspace, so
 * `requireRole(user, "owner", "admin")` does not stop a regular customer from
 * calling this endpoint. The route therefore MUST NOT let the caller write
 * security-sensitive company fields:
 *   - `subscriptionTier` (the paywall boundary / one-free-audit moat)
 *   - billing-owned `settings` keys (stripeCustomerId / stripeSubscriptionId)
 *
 * These tests lock that behaviour in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: () => ({
    API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64"),
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  }),
}));

const mockFindUniqueOrThrow = vi.fn();
const mockUpdate            = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    company: {
      findUniqueOrThrow: (...a: unknown[]) => mockFindUniqueOrThrow(...a),
      update:            (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

// Keep the REAL requireRole (so the role gate is genuinely exercised); only
// stub requireUser. Neutralise the Supabase client that lib/auth imports.
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser: vi.fn() };
});

import { GET, PATCH } from "@/app/api/companies/me/route";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";

const mockRequireUser = vi.mocked(requireUser);

type Role = "owner" | "admin" | "member" | "viewer";

function loginAs(role: Role = "owner") {
  mockRequireUser.mockResolvedValue({
    user: { id: "user-1", companyId: "company-1", role },
    authId: "user-1",
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
}

function patchReq(body: unknown) {
  return new Request("http://localhost/api/companies/me", {
    method: "POST", // method is ignored by the handler; body/json is what matters
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The `data` object passed to prisma.company.update for the most recent call. */
function lastUpdateData(): Record<string, unknown> {
  const call = mockUpdate.mock.calls.at(-1);
  return (call?.[0] as { data: Record<string, unknown> }).data;
}

afterEach(() => vi.resetAllMocks());

// ---------------------------------------------------------------------------
// Billing bypass — the core regression
// ---------------------------------------------------------------------------

describe("PATCH /api/companies/me — cannot self-grant a subscription tier", () => {
  it("rejects { subscriptionTier } with 400 and never writes the company", async () => {
    loginAs("owner");
    const res = await PATCH(patchReq({ subscriptionTier: "enterprise" }));

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects subscriptionTier even when smuggled next to a valid field", async () => {
    loginAs("owner");
    const res = await PATCH(patchReq({ name: "Evil Corp", subscriptionTier: "team" }));

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each(["starter", "team", "enterprise"] as const)(
    "blocks self-upgrade to the paid tier %s",
    async (tier) => {
      loginAs("admin");
      const res = await PATCH(patchReq({ subscriptionTier: tier }));
      expect(res.status).toBe(400);
      expect(mockUpdate).not.toHaveBeenCalled();
    },
  );

  it("never includes subscriptionTier in the data written for a legit update", async () => {
    loginAs("owner");
    mockUpdate.mockResolvedValue({ id: "company-1", name: "New Name" });

    const res = await PATCH(patchReq({ name: "New Name" }));

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect("subscriptionTier" in lastUpdateData()).toBe(false);
    expect(lastUpdateData().name).toBe("New Name");
  });
});

// ---------------------------------------------------------------------------
// Legit field updates still work
// ---------------------------------------------------------------------------

describe("PATCH /api/companies/me — legitimate updates", () => {
  it("updates the company name for an owner", async () => {
    loginAs("owner");
    mockUpdate.mockResolvedValue({ id: "company-1", name: "Acme" });

    const res = await PATCH(patchReq({ name: "Acme" }));
    expect(res.status).toBe(200);
    expect(lastUpdateData()).toMatchObject({ name: "Acme" });
  });

  it("updates the slug for an admin", async () => {
    loginAs("admin");
    mockUpdate.mockResolvedValue({ id: "company-1", slug: "acme-inc" });

    const res = await PATCH(patchReq({ slug: "acme-inc" }));
    expect(res.status).toBe(200);
    expect(lastUpdateData()).toMatchObject({ slug: "acme-inc" });
  });

  it("does not read existing settings when none are supplied", async () => {
    loginAs("owner");
    mockUpdate.mockResolvedValue({ id: "company-1", name: "Acme" });

    await PATCH(patchReq({ name: "Acme" }));
    expect(mockFindUniqueOrThrow).not.toHaveBeenCalled();
    expect(lastUpdateData().settings).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// settings merge + reserved-key stripping
// ---------------------------------------------------------------------------

describe("PATCH /api/companies/me — settings are merged and billing keys protected", () => {
  it("strips stripeCustomerId from the payload and preserves the stored one", async () => {
    loginAs("owner");
    mockFindUniqueOrThrow.mockResolvedValue({
      settings: { stripeCustomerId: "cus_real", stripeSubscriptionId: "sub_real", theme: "light" },
    });
    mockUpdate.mockResolvedValue({ id: "company-1" });

    const res = await PATCH(
      patchReq({ settings: { theme: "dark", stripeCustomerId: "cus_attacker", newPref: true } }),
    );

    expect(res.status).toBe(200);
    const written = lastUpdateData().settings as Record<string, unknown>;
    // Attacker value never lands; the real linkage survives the merge.
    expect(written.stripeCustomerId).toBe("cus_real");
    expect(written.stripeSubscriptionId).toBe("sub_real");
    // Non-reserved keys merge in / overwrite as expected.
    expect(written.theme).toBe("dark");
    expect(written.newPref).toBe(true);
  });

  it("cannot inject stripeSubscriptionId onto a company without one", async () => {
    loginAs("owner");
    mockFindUniqueOrThrow.mockResolvedValue({ settings: {} });
    mockUpdate.mockResolvedValue({ id: "company-1" });

    const res = await PATCH(patchReq({ settings: { stripeSubscriptionId: "sub_evil" } }));

    expect(res.status).toBe(200);
    const written = lastUpdateData().settings as Record<string, unknown>;
    expect("stripeSubscriptionId" in written).toBe(false);
    expect(written).toEqual({});
  });

  it("treats null stored settings as an empty object", async () => {
    loginAs("owner");
    mockFindUniqueOrThrow.mockResolvedValue({ settings: null });
    mockUpdate.mockResolvedValue({ id: "company-1" });

    const res = await PATCH(patchReq({ settings: { theme: "dark" } }));

    expect(res.status).toBe(200);
    expect(lastUpdateData().settings).toEqual({ theme: "dark" });
  });
});

// ---------------------------------------------------------------------------
// Auth / role gating
// ---------------------------------------------------------------------------

describe("PATCH /api/companies/me — auth & role gating", () => {
  it.each(["member", "viewer"] as const)("rejects role %s with 403", async (role) => {
    loginAs(role);
    const res = await PATCH(patchReq({ name: "Acme" }));

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 401 when the session is missing", async () => {
    mockRequireUser.mockRejectedValue(new ApiError(401, "unauthenticated"));
    const res = await PATCH(patchReq({ name: "Acme" }));

    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an empty body with 400", async () => {
    loginAs("owner");
    const res = await PATCH(patchReq({}));

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects unknown fields with 400", async () => {
    loginAs("owner");
    const res = await PATCH(patchReq({ hacker: true }));

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET sanity
// ---------------------------------------------------------------------------

describe("GET /api/companies/me", () => {
  it("returns the caller's company", async () => {
    loginAs("owner");
    mockFindUniqueOrThrow.mockResolvedValue({ id: "company-1", name: "Acme", slug: "acme" });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.company).toMatchObject({ id: "company-1", name: "Acme" });
  });
});

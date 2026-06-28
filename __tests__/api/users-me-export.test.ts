import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Regression suite for the cross-tenant data leak in GET /api/users/me/export.
//
// The export endpoint used to call `prisma.apiKey.findMany({ where: { isActive,
// deletedAt } })` with NO company scope, returning every tenant's API keys
// (id, label, key fragment, provider) to any authenticated user. These tests
// pin the fix: the query must be scoped to the caller's company.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

const mockUserFindUniqueOrThrow = vi.fn();
const mockPrefsFindUnique = vi.fn();
const mockApiKeyFindMany = vi.fn();
const mockAuditFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUniqueOrThrow: (...a: unknown[]) => mockUserFindUniqueOrThrow(...a) },
    userPreferences: { findUnique: (...a: unknown[]) => mockPrefsFindUnique(...a) },
    apiKey: { findMany: (...a: unknown[]) => mockApiKeyFindMany(...a) },
    audit: { findMany: (...a: unknown[]) => mockAuditFindMany(...a) },
  },
}));

import { requireUser } from "@/lib/auth";
import { GET } from "@/app/api/users/me/export/route";

const mockRequireUser = vi.mocked(requireUser);

const CALLER = { id: "user-1", companyId: "company-1", email: "alice@acme.test" };

type SessionUser = Awaited<ReturnType<typeof requireUser>>["user"];

// A two-tenant fixture. The mock implementation below honours the `where`
// clause, so a query that forgets `companyId` will (correctly) return the
// other tenant's keys and fail the assertions — exactly the bug we are
// guarding against.
const ALL_KEYS = [
  {
    companyId: "company-1",
    id: "key-mine",
    label: "Prod OpenAI",
    keyIdentifier: "aaaa",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    provider: { displayName: "OpenAI" },
  },
  {
    companyId: "company-2",
    id: "key-theirs",
    label: "Other Co Anthropic",
    keyIdentifier: "zzzz",
    createdAt: new Date("2026-03-01T00:00:00Z"),
    provider: { displayName: "Anthropic" },
  },
];

function applyKeyFilter(where: Record<string, unknown> | undefined) {
  return ALL_KEYS.filter((k) => {
    if (where?.companyId !== undefined && k.companyId !== where.companyId) return false;
    return true;
  });
}

beforeEach(() => {
  mockRequireUser.mockResolvedValue({ user: CALLER as unknown as SessionUser, authId: CALLER.id });
  mockUserFindUniqueOrThrow.mockResolvedValue({
    id: CALLER.id,
    name: "Alice",
    email: CALLER.email,
    role: "owner",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    company: { id: CALLER.companyId, name: "Acme", slug: "acme" },
  });
  mockPrefsFindUnique.mockResolvedValue({ emailDigest: "weekly", currency: "USD" });
  mockApiKeyFindMany.mockImplementation((args: { where?: Record<string, unknown> }) =>
    Promise.resolve(applyKeyFilter(args?.where)),
  );
  mockAuditFindMany.mockResolvedValue([]);
});

afterEach(() => vi.resetAllMocks());

describe("GET /api/users/me/export", () => {
  it("scopes the API key query to the caller's company", async () => {
    await GET();

    expect(mockApiKeyFindMany).toHaveBeenCalledTimes(1);
    const arg = mockApiKeyFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where.companyId).toBe("company-1");
    expect(arg.where.isActive).toBe(true);
    expect(arg.where.deletedAt).toBeNull();
  });

  it("never returns another tenant's API keys (no cross-tenant leak)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    const ids = body.apiKeys.map((k: { id: string }) => k.id);
    expect(ids).toEqual(["key-mine"]);
    expect(ids).not.toContain("key-theirs");

    // The leaked field was a fragment of OTHER companies' provider keys.
    const fragments = body.apiKeys.map((k: { keyFragment: string | null }) => k.keyFragment);
    expect(fragments).not.toContain("\u2026zzzz");
    expect(JSON.stringify(body)).not.toContain("Other Co Anthropic");
  });

  it("masks the caller's own key as a trailing fragment", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.apiKeys).toHaveLength(1);
    expect(body.apiKeys[0]).toMatchObject({
      id: "key-mine",
      label: "Prod OpenAI",
      provider: "OpenAI",
      keyFragment: "\u2026aaaa",
    });
  });

  it("renders a null key fragment when no identifier is stored", async () => {
    mockApiKeyFindMany.mockResolvedValueOnce([
      {
        companyId: "company-1",
        id: "key-nofrag",
        label: null,
        keyIdentifier: null,
        createdAt: new Date("2026-02-02T00:00:00Z"),
        provider: { displayName: "OpenAI" },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.apiKeys[0].keyFragment).toBeNull();
  });

  it("scopes audit history to the authenticated user", async () => {
    await GET();
    expect(mockAuditFindMany).toHaveBeenCalledTimes(1);
    const arg = mockAuditFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where.initiatedBy).toBe("user-1");
  });

  it("returns an empty key list when the company has none", async () => {
    mockApiKeyFindMany.mockResolvedValueOnce([]);
    const res = await GET();
    const body = await res.json();
    expect(body.apiKeys).toEqual([]);
  });

  it("returns the profile + a JSON attachment download", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain(CALLER.id);

    const body = await res.json();
    expect(body.user).toMatchObject({ id: CALLER.id, email: CALLER.email, role: "owner" });
    expect(body.user.company).toMatchObject({ id: CALLER.companyId, slug: "acme" });
    expect(body.exportedAt).toBeTruthy();
  });

  it("returns 401 and runs no data queries when unauthenticated", async () => {
    const { ApiError } = await import("@/lib/api-errors");
    mockRequireUser.mockReset();
    mockRequireUser.mockRejectedValueOnce(new ApiError(401, "unauthenticated"));

    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockApiKeyFindMany).not.toHaveBeenCalled();
    expect(mockAuditFindMany).not.toHaveBeenCalled();
    expect(mockUserFindUniqueOrThrow).not.toHaveBeenCalled();
  });
});

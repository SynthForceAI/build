import { afterEach, describe, expect, it, vi } from "vitest";

// Env + Supabase are loaded transitively by the real requireRole/isOwner we
// keep below; stub them so nothing tries to reach a real Supabase/env.
vi.mock("@/lib/env", () => ({
  env: () => ({
    API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64"),
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}));

// Keep the REAL requireRole + isOwner (genuine role enforcement); mock only the
// session lookup.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser: vi.fn() };
});

const mockAgentFindFirst = vi.fn();
const mockAgentUpdate    = vi.fn();
const mockAgentCreate    = vi.fn();
const mockDeptFindFirst  = vi.fn();
const mockApiKeyFindFirst = vi.fn();
const mockUserFindFirst  = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    agent: {
      findFirst: (...a: unknown[]) => mockAgentFindFirst(...a),
      update:    (...a: unknown[]) => mockAgentUpdate(...a),
      create:    (...a: unknown[]) => mockAgentCreate(...a),
    },
    department: { findFirst: (...a: unknown[]) => mockDeptFindFirst(...a) },
    apiKey:     { findFirst: (...a: unknown[]) => mockApiKeyFindFirst(...a) },
    user:       { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
  },
}));

import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { PATCH } from "@/app/api/agents/[id]/route";
import { POST } from "@/app/api/agents/route";

const mockRequireUser = vi.mocked(requireUser);

// Valid UUIDs (the routes Uuid.parse everything).
const AGENT_ID   = "11111111-1111-1111-1111-111111111111";
const COMPANY_A  = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEPT_A     = "22222222-2222-2222-2222-222222222222";
const KEY_A      = "33333333-3333-3333-3333-333333333333";
const USER_A     = "44444444-4444-4444-4444-444444444444";
const FOREIGN_ID = "99999999-9999-9999-9999-999999999999"; // belongs to company B

afterEach(() => vi.resetAllMocks());

function authAs(role: "owner" | "admin" | "member" | "viewer") {
  mockRequireUser.mockResolvedValueOnce({
    user: { id: USER_A, companyId: COMPANY_A, role, email: "u@a.com" },
    authId: USER_A,
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
}

function fullAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_ID,
    companyId: COMPANY_A,
    name: "Agent A",
    status: "active",
    monthlyBudgetCents: 0n,
    currentMonthSpendCents: 0n,
    totalLifetimeSpendCents: 0n,
    totalTokensIn: 0n,
    totalTokensOut: 0n,
    ...overrides,
  };
}

function patchReq(body: unknown, id = AGENT_ID) {
  const req = new Request(`http://localhost/api/agents/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
}

function postReq(body: unknown) {
  const req = new Request(`http://localhost/api/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ===========================================================================
// PATCH /api/agents/:id  — cross-tenant FK enforcement (the fix)
// ===========================================================================

describe("PATCH /api/agents/:id — cross-tenant FK enforcement", () => {
  it("rejects a cross-tenant departmentId with 400 and never updates", async () => {
    authAs("admin");
    mockAgentFindFirst.mockResolvedValueOnce(fullAgent()); // agent owned by company A
    mockDeptFindFirst.mockResolvedValueOnce(null);         // dept not in company A

    const res = await patchReq({ departmentId: FOREIGN_ID });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("department_not_found");
    expect(mockAgentUpdate).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant apiKeyId with 400 and never updates", async () => {
    authAs("admin");
    mockAgentFindFirst.mockResolvedValueOnce(fullAgent());
    mockApiKeyFindFirst.mockResolvedValueOnce(null);

    const res = await patchReq({ apiKeyId: FOREIGN_ID });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("api_key_not_found");
    expect(mockAgentUpdate).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant managedBy (PII-leak vector) with 400 and never updates", async () => {
    authAs("admin");
    mockAgentFindFirst.mockResolvedValueOnce(fullAgent());
    mockUserFindFirst.mockResolvedValueOnce(null); // victim user is in another company

    const res = await patchReq({ managedBy: FOREIGN_ID });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("managed_by_not_in_company");
    expect(mockAgentUpdate).not.toHaveBeenCalled();
  });

  it("allows an in-company departmentId and performs the update", async () => {
    authAs("admin");
    mockAgentFindFirst.mockResolvedValueOnce(fullAgent());
    mockDeptFindFirst.mockResolvedValueOnce({ id: DEPT_A });
    mockAgentUpdate.mockResolvedValueOnce(fullAgent({ departmentId: DEPT_A }));

    const res = await patchReq({ departmentId: DEPT_A });
    expect(res.status).toBe(200);
    expect(mockDeptFindFirst).toHaveBeenCalledWith({
      where: { id: DEPT_A, companyId: COMPANY_A },
      select: { id: true },
    });
    expect(mockAgentUpdate).toHaveBeenCalledTimes(1);
  });

  it("validates every in-company FK when all three are supplied", async () => {
    authAs("owner");
    mockAgentFindFirst.mockResolvedValueOnce(fullAgent());
    mockDeptFindFirst.mockResolvedValueOnce({ id: DEPT_A });
    mockApiKeyFindFirst.mockResolvedValueOnce({ id: KEY_A });
    mockUserFindFirst.mockResolvedValueOnce({ id: USER_A });
    mockAgentUpdate.mockResolvedValueOnce(fullAgent());

    const res = await patchReq({ departmentId: DEPT_A, apiKeyId: KEY_A, managedBy: USER_A });
    expect(res.status).toBe(200);
    expect(mockDeptFindFirst).toHaveBeenCalledTimes(1);
    expect(mockApiKeyFindFirst).toHaveBeenCalledTimes(1);
    expect(mockUserFindFirst).toHaveBeenCalledTimes(1);
  });

  it("allows clearing relations with null without any FK lookup", async () => {
    authAs("admin");
    mockAgentFindFirst.mockResolvedValueOnce(fullAgent());
    mockAgentUpdate.mockResolvedValueOnce(fullAgent({ departmentId: null, managedBy: null }));

    const res = await patchReq({ departmentId: null, managedBy: null });
    expect(res.status).toBe(200);
    expect(mockDeptFindFirst).not.toHaveBeenCalled();
    expect(mockUserFindFirst).not.toHaveBeenCalled();
    expect(mockAgentUpdate).toHaveBeenCalledTimes(1);
  });

  it("does no FK lookups for a non-FK update (status only)", async () => {
    authAs("member");
    mockAgentFindFirst.mockResolvedValueOnce(fullAgent());
    mockAgentUpdate.mockResolvedValueOnce(fullAgent({ status: "paused" }));

    const res = await patchReq({ status: "paused" });
    expect(res.status).toBe(200);
    expect(mockDeptFindFirst).not.toHaveBeenCalled();
    expect(mockApiKeyFindFirst).not.toHaveBeenCalled();
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("still enforces agent ownership (404 when agent is not in the company)", async () => {
    authAs("admin");
    mockAgentFindFirst.mockResolvedValueOnce(null); // not found within company A

    const res = await patchReq({ departmentId: DEPT_A });
    expect(res.status).toBe(404);
    expect(mockDeptFindFirst).not.toHaveBeenCalled();
    expect(mockAgentUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for a viewer (insufficient role) before touching the DB", async () => {
    authAs("viewer");
    const res = await patchReq({ departmentId: DEPT_A });
    expect(res.status).toBe(403);
    expect(mockAgentFindFirst).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockRejectedValueOnce(new ApiError(401, "unauthenticated"));
    const res = await patchReq({ status: "paused" });
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// POST /api/agents — regression guard that create still validates via the
// shared helper (so create + update stay in lock-step).
// ===========================================================================

describe("POST /api/agents — create still validates FKs", () => {
  it("rejects a cross-tenant apiKeyId with 400 and never creates", async () => {
    authAs("admin");
    mockApiKeyFindFirst.mockResolvedValueOnce(null);

    const res = await postReq({ name: "New", apiKeyId: FOREIGN_ID });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("api_key_not_found");
    expect(mockAgentCreate).not.toHaveBeenCalled();
  });

  it("creates when all references are in-company", async () => {
    authAs("admin");
    mockDeptFindFirst.mockResolvedValueOnce({ id: DEPT_A });
    mockAgentCreate.mockResolvedValueOnce(fullAgent({ departmentId: DEPT_A }));

    const res = await postReq({ name: "New", departmentId: DEPT_A });
    expect(res.status).toBe(201);
    expect(mockAgentCreate).toHaveBeenCalledTimes(1);
  });
});

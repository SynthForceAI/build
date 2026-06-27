import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser: vi.fn() };
});

const mockPolicyFindFirst = vi.fn();
const mockPolicyUpdate    = vi.fn();
const mockPolicyCreate    = vi.fn();
const mockDeptFindFirst   = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    policy: {
      findFirst: (...a: unknown[]) => mockPolicyFindFirst(...a),
      update:    (...a: unknown[]) => mockPolicyUpdate(...a),
      create:    (...a: unknown[]) => mockPolicyCreate(...a),
    },
    department: { findFirst: (...a: unknown[]) => mockDeptFindFirst(...a) },
  },
}));

import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { PATCH } from "@/app/api/policies/[id]/route";
import { POST } from "@/app/api/policies/route";

const mockRequireUser = vi.mocked(requireUser);

const POLICY_ID  = "11111111-1111-1111-1111-111111111111";
const COMPANY_A  = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEPT_A     = "22222222-2222-2222-2222-222222222222";
const USER_A     = "44444444-4444-4444-4444-444444444444";
const FOREIGN_DEPT = "99999999-9999-9999-9999-999999999999"; // department in company B

afterEach(() => vi.resetAllMocks());

function authAs(role: "owner" | "admin" | "member" | "viewer") {
  mockRequireUser.mockResolvedValueOnce({
    user: { id: USER_A, companyId: COMPANY_A, role, email: "u@a.com" },
    authId: USER_A,
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
}

function patchReq(body: unknown, id = POLICY_ID) {
  const req = new Request(`http://localhost/api/policies/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
}

function postReq(body: unknown) {
  const req = new Request(`http://localhost/api/policies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

const BUDGET_RULE = { type: "budget", operator: "less_than", field: "monthly_spend", valueCents: 1000 };

// ===========================================================================
// PATCH /api/policies/:id — cross-tenant scopeDepartmentId enforcement (the fix)
// ===========================================================================

describe("PATCH /api/policies/:id — cross-tenant scopeDepartmentId enforcement", () => {
  it("rejects a cross-tenant scopeDepartmentId with 400 and never updates", async () => {
    authAs("admin");
    mockPolicyFindFirst.mockResolvedValueOnce({ id: POLICY_ID, companyId: COMPANY_A });
    mockDeptFindFirst.mockResolvedValueOnce(null); // dept not in company A

    const res = await patchReq({ scopeDepartmentId: FOREIGN_DEPT });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("department_not_found");
    expect(mockPolicyUpdate).not.toHaveBeenCalled();
  });

  it("allows an in-company scopeDepartmentId and performs the update", async () => {
    authAs("admin");
    mockPolicyFindFirst.mockResolvedValueOnce({ id: POLICY_ID, companyId: COMPANY_A });
    mockDeptFindFirst.mockResolvedValueOnce({ id: DEPT_A });
    mockPolicyUpdate.mockResolvedValueOnce({ id: POLICY_ID, scopeDepartmentId: DEPT_A });

    const res = await patchReq({ scopeDepartmentId: DEPT_A });
    expect(res.status).toBe(200);
    expect(mockDeptFindFirst).toHaveBeenCalledWith({
      where: { id: DEPT_A, companyId: COMPANY_A },
      select: { id: true },
    });
    expect(mockPolicyUpdate).toHaveBeenCalledTimes(1);
  });

  it("does no department lookup for a non-department update (name only)", async () => {
    authAs("admin");
    mockPolicyFindFirst.mockResolvedValueOnce({ id: POLICY_ID, companyId: COMPANY_A });
    mockPolicyUpdate.mockResolvedValueOnce({ id: POLICY_ID, name: "Renamed" });

    const res = await patchReq({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(mockDeptFindFirst).not.toHaveBeenCalled();
    expect(mockPolicyUpdate).toHaveBeenCalledTimes(1);
  });

  it("still enforces policy ownership (404 when policy is not in the company)", async () => {
    authAs("admin");
    mockPolicyFindFirst.mockResolvedValueOnce(null);

    const res = await patchReq({ scopeDepartmentId: DEPT_A });
    expect(res.status).toBe(404);
    expect(mockDeptFindFirst).not.toHaveBeenCalled();
    expect(mockPolicyUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for a member (owner/admin only) before touching the DB", async () => {
    authAs("member");
    const res = await patchReq({ name: "Renamed" });
    expect(res.status).toBe(403);
    expect(mockPolicyFindFirst).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockRejectedValueOnce(new ApiError(401, "unauthenticated"));
    const res = await patchReq({ name: "Renamed" });
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// POST /api/policies — regression guard that create still validates the scope
// department via the shared helper.
// ===========================================================================

describe("POST /api/policies — create still validates scopeDepartmentId", () => {
  it("rejects a cross-tenant scopeDepartmentId with 400 and never creates", async () => {
    authAs("admin");
    mockDeptFindFirst.mockResolvedValueOnce(null);

    const res = await postReq({
      name: "Dept policy",
      ruleDefinition: BUDGET_RULE,
      scope: "department",
      scopeDepartmentId: FOREIGN_DEPT,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("department_not_found");
    expect(mockPolicyCreate).not.toHaveBeenCalled();
  });

  it("creates when the scope department is in-company", async () => {
    authAs("admin");
    mockDeptFindFirst.mockResolvedValueOnce({ id: DEPT_A });
    mockPolicyCreate.mockResolvedValueOnce({ id: POLICY_ID, scopeDepartmentId: DEPT_A });

    const res = await postReq({
      name: "Dept policy",
      ruleDefinition: BUDGET_RULE,
      scope: "department",
      scopeDepartmentId: DEPT_A,
    });
    expect(res.status).toBe(201);
    expect(mockPolicyCreate).toHaveBeenCalledTimes(1);
  });
});

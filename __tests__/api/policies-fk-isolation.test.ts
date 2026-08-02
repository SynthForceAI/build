/**
 * Cross-tenant foreign-key isolation for the policies API.
 *
 * `PATCH /api/policies/:id` let a department-scoped policy be re-pointed at a
 * `scopeDepartmentId` in another company (the create path validated it; the
 * update path did not). These tests lock the rule in for both verbs.
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

const policyFindFirst = vi.fn();
const policyUpdate = vi.fn();
const policyCreate = vi.fn();
const deptFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    policy: {
      findFirst: (...a: unknown[]) => policyFindFirst(...a),
      update: (...a: unknown[]) => policyUpdate(...a),
      create: (...a: unknown[]) => policyCreate(...a),
    },
    department: { findFirst: (...a: unknown[]) => deptFindFirst(...a) },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser: vi.fn() };
});

import { PATCH } from "@/app/api/policies/[id]/route";
import { POST } from "@/app/api/policies/route";
import { requireUser } from "@/lib/auth";

const mockRequireUser = vi.mocked(requireUser);

const OWN_POLICY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOREIGN_DEPT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IN_COMPANY_DEPT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function loginAs(role = "owner") {
  mockRequireUser.mockResolvedValue({
    user: { id: "user-1", companyId: "company-1", role },
    authId: "user-1",
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
}

const patchCtx = { params: Promise.resolve({ id: OWN_POLICY }) };

function patchReq(body: unknown) {
  return new Request(`http://localhost/api/policies/${OWN_POLICY}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function postReq(body: unknown) {
  return new Request("http://localhost/api/policies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validRule = { type: "rate_limit", perMinute: 60 };

afterEach(() => vi.resetAllMocks());

// ---------------------------------------------------------------------------
// PATCH /api/policies/:id
// ---------------------------------------------------------------------------

describe("PATCH /api/policies/:id — cross-tenant scopeDepartmentId is rejected", () => {
  it("rejects a foreign scopeDepartmentId and never updates", async () => {
    loginAs("owner");
    policyFindFirst.mockResolvedValueOnce({ id: OWN_POLICY }); // caller owns the policy
    deptFindFirst.mockResolvedValueOnce(null); // dept lives in another company

    const res = await PATCH(patchReq({ scopeDepartmentId: FOREIGN_DEPT }), patchCtx);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("department_not_found");
    expect(policyUpdate).not.toHaveBeenCalled();
  });

  it("allows a rename with no scopeDepartmentId", async () => {
    loginAs("owner");
    policyFindFirst.mockResolvedValueOnce({ id: OWN_POLICY });
    policyUpdate.mockResolvedValueOnce({ id: OWN_POLICY, name: "Renamed" });

    const res = await PATCH(patchReq({ name: "Renamed" }), patchCtx);

    expect(res.status).toBe(200);
    expect(deptFindFirst).not.toHaveBeenCalled();
    expect(policyUpdate).toHaveBeenCalledTimes(1);
  });

  it("allows an in-company scopeDepartmentId (tenant-scoped lookup)", async () => {
    loginAs("admin");
    policyFindFirst.mockResolvedValueOnce({ id: OWN_POLICY });
    deptFindFirst.mockResolvedValueOnce({ id: IN_COMPANY_DEPT });
    policyUpdate.mockResolvedValueOnce({ id: OWN_POLICY });

    const res = await PATCH(patchReq({ scopeDepartmentId: IN_COMPANY_DEPT }), patchCtx);

    expect(res.status).toBe(200);
    expect(deptFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: IN_COMPANY_DEPT, companyId: "company-1" } }),
    );
    expect(policyUpdate).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/policies
// ---------------------------------------------------------------------------

describe("POST /api/policies — cross-tenant scopeDepartmentId is rejected", () => {
  it("rejects a foreign scopeDepartmentId and never creates", async () => {
    loginAs("owner");
    deptFindFirst.mockResolvedValueOnce(null);

    const res = await POST(
      postReq({ name: "P", ruleDefinition: validRule, scopeDepartmentId: FOREIGN_DEPT }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("department_not_found");
    expect(policyCreate).not.toHaveBeenCalled();
  });

  it("creates a global policy with no scopeDepartmentId", async () => {
    loginAs("owner");
    policyCreate.mockResolvedValueOnce({ id: OWN_POLICY, name: "P" });

    const res = await POST(postReq({ name: "P", ruleDefinition: validRule }));

    expect(res.status).toBe(201);
    expect(deptFindFirst).not.toHaveBeenCalled();
    expect(policyCreate).toHaveBeenCalledTimes(1);
  });
});

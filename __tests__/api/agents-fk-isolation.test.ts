/**
 * Cross-tenant foreign-key isolation for the agents API.
 *
 * Regression for a broken-object-level-authorization (IDOR) bug: `PATCH
 * /api/agents/:id` spread the request body straight into `prisma.agent.update`
 * after only checking that the *agent* belonged to the caller's company. The
 * body can carry company-scoped FKs (`managedBy`, `departmentId`, `apiKeyId`)
 * that were never validated, so a user could re-point their own agent at
 * another tenant's row and read it back through the response `include`
 * (most damagingly `manager.email` — cross-tenant PII). `POST /api/agents`
 * already guarded these; these tests lock the rule in for both verbs.
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

const agentFindFirst = vi.fn();
const agentUpdate = vi.fn();
const agentCreate = vi.fn();
const deptFindFirst = vi.fn();
const apiKeyFindFirst = vi.fn();
const userFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    agent: {
      findFirst: (...a: unknown[]) => agentFindFirst(...a),
      update: (...a: unknown[]) => agentUpdate(...a),
      create: (...a: unknown[]) => agentCreate(...a),
    },
    department: { findFirst: (...a: unknown[]) => deptFindFirst(...a) },
    apiKey: { findFirst: (...a: unknown[]) => apiKeyFindFirst(...a) },
    user: { findFirst: (...a: unknown[]) => userFindFirst(...a) },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}));

// Keep the REAL requireRole so the role gate is genuinely exercised.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser: vi.fn() };
});

import { PATCH } from "@/app/api/agents/[id]/route";
import { POST } from "@/app/api/agents/route";
import { requireUser } from "@/lib/auth";

const mockRequireUser = vi.mocked(requireUser);

// Valid UUIDs used across the suite.
const OWN_AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOREIGN_DEPT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FOREIGN_KEY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FOREIGN_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const IN_COMPANY_USER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function loginAs(role = "owner") {
  mockRequireUser.mockResolvedValue({
    user: { id: "user-1", companyId: "company-1", role },
    authId: "user-1",
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
}

/** An agent row with the BigInt fields serialize() expects. */
function agentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OWN_AGENT,
    companyId: "company-1",
    name: "Agent",
    monthlyBudgetCents: BigInt(0),
    currentMonthSpendCents: BigInt(0),
    totalLifetimeSpendCents: BigInt(0),
    totalTokensIn: BigInt(0),
    totalTokensOut: BigInt(0),
    ...overrides,
  };
}

function patchReq(body: unknown) {
  return new Request(`http://localhost/api/agents/${OWN_AGENT}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function postReq(body: unknown) {
  return new Request("http://localhost/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const patchCtx = { params: Promise.resolve({ id: OWN_AGENT }) };

afterEach(() => vi.resetAllMocks());

// ---------------------------------------------------------------------------
// PATCH /api/agents/:id — the vulnerable path
// ---------------------------------------------------------------------------

describe("PATCH /api/agents/:id — cross-tenant FK is rejected", () => {
  it("rejects a cross-tenant managedBy (PII-leak vector) and never updates", async () => {
    loginAs("owner");
    agentFindFirst.mockResolvedValueOnce(agentRow()); // caller owns the agent
    userFindFirst.mockResolvedValueOnce(null); // manager lives in another company

    const res = await PATCH(patchReq({ managedBy: FOREIGN_USER }), patchCtx);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("managed_by_not_in_company");
    expect(agentUpdate).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant departmentId and never updates", async () => {
    loginAs("owner");
    agentFindFirst.mockResolvedValueOnce(agentRow());
    deptFindFirst.mockResolvedValueOnce(null);

    const res = await PATCH(patchReq({ departmentId: FOREIGN_DEPT }), patchCtx);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("department_not_found");
    expect(agentUpdate).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant apiKeyId and never updates", async () => {
    loginAs("owner");
    agentFindFirst.mockResolvedValueOnce(agentRow());
    apiKeyFindFirst.mockResolvedValueOnce(null);

    const res = await PATCH(patchReq({ apiKeyId: FOREIGN_KEY }), patchCtx);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("api_key_not_found");
    expect(agentUpdate).not.toHaveBeenCalled();
  });

  it("still 404s for another company's agent before any FK check runs", async () => {
    loginAs("owner");
    agentFindFirst.mockResolvedValueOnce(null); // loadAgent scoped by companyId finds nothing

    const res = await PATCH(patchReq({ managedBy: FOREIGN_USER }), patchCtx);

    expect(res.status).toBe(404);
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(agentUpdate).not.toHaveBeenCalled();
  });

  it("allows an in-company managedBy and performs the update", async () => {
    loginAs("owner");
    agentFindFirst.mockResolvedValueOnce(agentRow());
    userFindFirst.mockResolvedValueOnce({ id: IN_COMPANY_USER }); // scoped lookup succeeds
    agentUpdate.mockResolvedValueOnce(agentRow({ managedBy: IN_COMPANY_USER }));

    const res = await PATCH(patchReq({ managedBy: IN_COMPANY_USER }), patchCtx);

    expect(res.status).toBe(200);
    expect(agentUpdate).toHaveBeenCalledTimes(1);
    // The in-company manager lookup must be tenant-scoped.
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: IN_COMPANY_USER, companyId: "company-1" } }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/agents — regression guard for the create path
// ---------------------------------------------------------------------------

describe("POST /api/agents — cross-tenant FK is rejected", () => {
  it("rejects a cross-tenant departmentId and never creates", async () => {
    loginAs("owner");
    deptFindFirst.mockResolvedValueOnce(null);

    const res = await POST(postReq({ name: "New Agent", departmentId: FOREIGN_DEPT }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("department_not_found");
    expect(agentCreate).not.toHaveBeenCalled();
  });

  it("creates an agent with no company-scoped FKs", async () => {
    loginAs("owner");
    agentCreate.mockResolvedValueOnce(agentRow());

    const res = await POST(postReq({ name: "New Agent" }));

    expect(res.status).toBe(201);
    expect(agentCreate).toHaveBeenCalledTimes(1);
  });
});

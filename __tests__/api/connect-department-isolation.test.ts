/**
 * Cross-tenant departmentId isolation for POST /api/api-keys/connect.
 *
 * The connect flow writes `parsed.departmentId` straight onto the new
 * ConnectedAgent + Agent rows. It never validated that the department belonged
 * to the caller's company, so a user could file their agent under another
 * tenant's department (leaking that department's name via the agents list
 * `include`). The guard must run BEFORE the provider key is verified or any
 * row is created.
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

const providerFindFirst = vi.fn();
const deptFindFirst = vi.fn();
const connectedAgentCreate = vi.fn();
const apiKeyCreate = vi.fn();
const apiKeyFindMany = vi.fn();
const apiKeyFindFirst = vi.fn();
const agentCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    provider: { findFirst: (...a: unknown[]) => providerFindFirst(...a) },
    department: { findFirst: (...a: unknown[]) => deptFindFirst(...a) },
    connectedAgent: { create: (...a: unknown[]) => connectedAgentCreate(...a) },
    agent: { create: (...a: unknown[]) => agentCreate(...a) },
    apiKey: {
      create: (...a: unknown[]) => apiKeyCreate(...a),
      findMany: (...a: unknown[]) => apiKeyFindMany(...a),
      findFirst: (...a: unknown[]) => apiKeyFindFirst(...a),
    },
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

const mockVerifyProviderKey = vi.fn();
vi.mock("@/lib/providers", () => ({ verifyProviderKey: (...a: unknown[]) => mockVerifyProviderKey(...a) }));
vi.mock("@/lib/audit/run", () => ({ runAudit: vi.fn() }));
vi.mock("@/lib/audit/quota", () => ({ assertCanRunAudit: vi.fn() }));
vi.mock("@/lib/providers/anthropic-connector", () => ({ resolveAnthropicKeyId: vi.fn() }));
vi.mock("@/lib/providers/sync-dispatch", () => ({ syncProviderUsage: vi.fn() }));

import { POST } from "@/app/api/api-keys/connect/route";
import { requireUser } from "@/lib/auth";

const mockRequireUser = vi.mocked(requireUser);

const PROVIDER = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const FOREIGN_DEPT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IN_COMPANY_DEPT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function loginAs(role = "owner") {
  mockRequireUser.mockResolvedValue({
    user: { id: "user-1", companyId: "company-1", role },
    authId: "user-1",
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
}

function connectReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/api-keys/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const baseBody = {
  providerId: PROVIDER,
  apiKey: "sk-personal-123",
  agentName: "My Agent",
  keyType: "personal" as const,
};

afterEach(() => vi.resetAllMocks());

describe("POST /api/api-keys/connect — cross-tenant departmentId", () => {
  it("rejects a foreign departmentId before verifying the key or creating rows", async () => {
    loginAs("owner");
    providerFindFirst.mockResolvedValueOnce({ id: PROVIDER, name: "openai", isActive: true, apiBaseUrl: "x" });
    deptFindFirst.mockResolvedValueOnce(null); // department belongs to another company

    const res = await POST(connectReq({ ...baseBody, departmentId: FOREIGN_DEPT }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("department_not_found");
    // The guard runs first: no external verification, no row creation.
    expect(mockVerifyProviderKey).not.toHaveBeenCalled();
    expect(connectedAgentCreate).not.toHaveBeenCalled();
    expect(agentCreate).not.toHaveBeenCalled();
    expect(apiKeyCreate).not.toHaveBeenCalled();
  });

  it("lets an in-company departmentId through to key verification", async () => {
    loginAs("owner");
    providerFindFirst.mockResolvedValueOnce({ id: PROVIDER, name: "openai", isActive: true, apiBaseUrl: "x" });
    deptFindFirst.mockResolvedValueOnce({ id: IN_COMPANY_DEPT }); // scoped lookup succeeds
    // Fail at verification so we don't have to mock the whole create pipeline;
    // reaching verification proves the department guard let the request pass.
    mockVerifyProviderKey.mockRejectedValueOnce(new Error("bad key"));

    const res = await POST(connectReq({ ...baseBody, departmentId: IN_COMPANY_DEPT }));

    expect(deptFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: IN_COMPANY_DEPT, companyId: "company-1" } }),
    );
    expect(mockVerifyProviderKey).toHaveBeenCalledTimes(1);
    expect((await res.json()).error.code).toBe("key_verification_failed");
  });

  it("skips the department check entirely when no departmentId is supplied", async () => {
    loginAs("owner");
    providerFindFirst.mockResolvedValueOnce({ id: PROVIDER, name: "openai", isActive: true, apiBaseUrl: "x" });
    mockVerifyProviderKey.mockRejectedValueOnce(new Error("bad key"));

    const res = await POST(connectReq({ ...baseBody }));

    expect(deptFindFirst).not.toHaveBeenCalled();
    expect(mockVerifyProviderKey).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(400);
  });
});

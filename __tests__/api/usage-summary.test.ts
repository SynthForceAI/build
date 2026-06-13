import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: () => ({
    API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64"),
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

const mockAggregate = vi.fn();
const mockGroupBy   = vi.fn();
const mockQueryRaw  = vi.fn();
const mockFindMany  = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    connectedAgentUsageLog: {
      aggregate: (...a: unknown[]) => mockAggregate(...a),
      groupBy:   (...a: unknown[]) => mockGroupBy(...a),
    },
    provider: { findMany: (...a: unknown[]) => mockFindMany(...a) },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

import { requireUser } from "@/lib/auth";
import { GET } from "@/app/api/companies/me/usage-summary/route";
import { NextRequest } from "next/server";

const mockRequireUser = vi.mocked(requireUser);

const COMPANY = { companyId: "company-uuid", id: "user-uuid" };

afterEach(() => vi.resetAllMocks());

function makeReq(params = "") {
  return new NextRequest(`http://localhost/api/companies/me/usage-summary${params}`);
}

// ---------------------------------------------------------------------------

describe("GET /api/companies/me/usage-summary", () => {
  it("returns totals + breakdown + daily series", async () => {
    mockRequireUser.mockResolvedValueOnce({ user: COMPANY } as ReturnType<typeof requireUser> extends Promise<infer T> ? Promise<T> : never);

    mockAggregate.mockResolvedValueOnce({
      _sum: { costCents: 12500, tokensIn: 500000, tokensOut: 150000, numRequests: 120 },
    });

    mockGroupBy.mockResolvedValueOnce([
      {
        providerId: "provider-anthropic",
        model: "claude-sonnet-4-6",
        _sum: { costCents: 7500, tokensIn: 300000, tokensOut: 90000, numRequests: 70 },
      },
      {
        providerId: "provider-openai",
        model: "gpt-4o-mini",
        _sum: { costCents: 5000, tokensIn: 200000, tokensOut: 60000, numRequests: 50 },
      },
    ]);

    mockQueryRaw.mockResolvedValueOnce([
      { day: new Date("2026-06-01"), cost_cents: 400 },
      { day: new Date("2026-06-02"), cost_cents: 350 },
    ]);

    mockFindMany.mockResolvedValueOnce([
      { id: "provider-anthropic", name: "anthropic", displayName: "Anthropic" },
      { id: "provider-openai",    name: "openai",    displayName: "OpenAI" },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.periodDays).toBe(30);
    expect(body.totals.costCents).toBe(12500);
    expect(body.totals.tokensIn).toBe(500000);
    expect(body.totals.requests).toBe(120);

    expect(body.breakdown).toHaveLength(2);
    expect(body.breakdown[0].model).toBe("claude-sonnet-4-6");
    expect(body.breakdown[0].providerName).toBe("anthropic");
    expect(body.breakdown[0].pctOfTotal).toBe(60); // 7500/12500

    expect(body.daily).toHaveLength(2);
    expect(body.daily[0].day).toBe("2026-06-01");
    expect(body.daily[0].costCents).toBe(400);
  });

  it("returns zero totals when no usage logged", async () => {
    mockRequireUser.mockResolvedValueOnce({ user: COMPANY } as ReturnType<typeof requireUser> extends Promise<infer T> ? Promise<T> : never);
    mockAggregate.mockResolvedValueOnce({ _sum: { costCents: null, tokensIn: null, tokensOut: null, numRequests: null } });
    mockGroupBy.mockResolvedValueOnce([]);
    mockQueryRaw.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totals.costCents).toBe(0);
    expect(body.breakdown).toHaveLength(0);
    expect(body.daily).toHaveLength(0);
  });

  it("clamps days param to 90", async () => {
    mockRequireUser.mockResolvedValueOnce({ user: COMPANY } as ReturnType<typeof requireUser> extends Promise<infer T> ? Promise<T> : never);
    mockAggregate.mockResolvedValueOnce({ _sum: {} });
    mockGroupBy.mockResolvedValueOnce([]);
    mockQueryRaw.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([]);

    const res = await GET(makeReq("?days=999"));
    const body = await res.json();
    expect(body.periodDays).toBe(90);
  });

  it("returns 401 when not authenticated", async () => {
    const { ApiError } = await import("@/lib/api-errors");
    mockRequireUser.mockRejectedValueOnce(new ApiError(401, "unauthenticated"));
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });
});

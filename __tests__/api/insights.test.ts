import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: () => ({
    API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64"),
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
  }),
}));

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));

const mockAggregate            = vi.fn();
const mockGroupBy              = vi.fn();
const mockQueryRaw             = vi.fn();
const mockFindMany             = vi.fn();
const mockFindUniqueOrThrow    = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    company:                { findUniqueOrThrow: (...a: unknown[]) => mockFindUniqueOrThrow(...a) },
    connectedAgentUsageLog: {
      aggregate: (...a: unknown[]) => mockAggregate(...a),
      groupBy:   (...a: unknown[]) => mockGroupBy(...a),
    },
    provider: { findMany: (...a: unknown[]) => mockFindMany(...a) },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

import { requireUser } from "@/lib/auth";
import { GET } from "@/app/api/companies/me/insights/route";
import { NextRequest } from "next/server";

const mockRequireUser = vi.mocked(requireUser);
const COMPANY_USER    = { companyId: "company-uuid", id: "user-uuid" };

afterEach(() => vi.resetAllMocks());

function makeReq(params = "") {
  return new NextRequest(`http://localhost/api/companies/me/insights${params}`);
}

function setupMocks({
  tier = "free",
  costCents = 0,
  priorCostCents = 0,
  models = [] as Array<{ providerId: string; model: string; cost: number; tokensIn: number; tokensOut: number; requests: number }>,
  providerList = [] as Array<{ id: string; name: string; displayName: string }>,
  dailyCosts = [] as number[],
} = {}) {
  mockRequireUser.mockResolvedValueOnce({ user: COMPANY_USER } as ReturnType<typeof requireUser> extends Promise<infer T> ? Promise<T> : never);
  mockFindUniqueOrThrow.mockResolvedValueOnce({ subscriptionTier: tier });

  // current period aggregate
  mockAggregate.mockResolvedValueOnce({
    _sum: { costCents, tokensIn: 1000, tokensOut: 500, numRequests: 10 },
  });

  // by-model groupBy
  mockGroupBy.mockResolvedValueOnce(
    models.map((m) => ({
      providerId: m.providerId,
      model: m.model,
      _sum: { costCents: m.cost, tokensIn: m.tokensIn, tokensOut: m.tokensOut, numRequests: m.requests },
    })),
  );

  // daily raw query
  mockQueryRaw.mockResolvedValueOnce(
    dailyCosts.map((c, i) => ({
      day: new Date(`2026-06-${String(i + 1).padStart(2, "0")}`),
      cost_cents: c,
    })),
  );

  // prior period aggregate
  mockAggregate.mockResolvedValueOnce({
    _sum: { costCents: priorCostCents },
  });

  mockFindMany.mockResolvedValueOnce(providerList);
}

// ---------------------------------------------------------------------------

describe("GET /api/companies/me/insights - structure", () => {
  it("returns all top-level keys", async () => {
    setupMocks();
    const res  = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("topModels");
    expect(body).toHaveProperty("trend");
    expect(body).toHaveProperty("benchmark");
    expect(body).toHaveProperty("recommendations");
    expect(body).toHaveProperty("potentialSavingsCents");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/companies/me/insights - trend", () => {
  it("detects upward trend", async () => {
    // second half costs more than first half
    setupMocks({ dailyCosts: [100, 100, 100, 100, 200, 200, 200, 200] });
    const body = await (await GET(makeReq())).json();
    expect(body.trend.direction).toBe("up");
  });

  it("detects downward trend", async () => {
    setupMocks({ dailyCosts: [200, 200, 200, 200, 100, 100, 100, 100] });
    const body = await (await GET(makeReq())).json();
    expect(body.trend.direction).toBe("down");
  });

  it("returns flat when insufficient data", async () => {
    setupMocks({ dailyCosts: [100, 100] });
    const body = await (await GET(makeReq())).json();
    expect(body.trend.direction).toBe("flat");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/companies/me/insights - benchmark", () => {
  it("labels spend above median correctly", async () => {
    // 30-day spend of $60 000 >> $3 000 free-tier median
    setupMocks({ tier: "free", costCents: 6_000_000 });
    const body = await (await GET(makeReq())).json();
    expect(body.benchmark.position).toBe("above");
    expect(body.benchmark.ratio).toBeGreaterThan(1.2);
  });

  it("labels spend below median correctly", async () => {
    setupMocks({ tier: "free", costCents: 100_00 }); // $100 - well below $3k median
    const body = await (await GET(makeReq())).json();
    expect(body.benchmark.position).toBe("below");
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/companies/me/insights - recommendations", () => {
  it("suggests model downgrade from opus to sonnet", async () => {
    setupMocks({
      tier: "free",
      costCents: 50_000_00,
      models: [{
        providerId: "p-anthropic",
        model: "claude-opus-4-8",
        cost: 50_000_00,
        tokensIn:  1_000_000,
        tokensOut: 800_000,
        requests: 200,
      }],
      providerList: [{ id: "p-anthropic", name: "anthropic", displayName: "Anthropic" }],
    });

    const body = await (await GET(makeReq())).json();
    const downgrade = body.recommendations.find(
      (r: { type: string }) => r.type === "model_downgrade",
    );
    expect(downgrade).toBeDefined();
    expect(downgrade.potentialSavingsCents).toBeGreaterThan(0);
    expect(downgrade.title).toMatch(/claude-opus-4-8/);
  });

  it("surfaces high output ratio recommendation", async () => {
    setupMocks({
      models: [{
        providerId: "p-openai",
        model: "gpt-4o",
        cost: 10_000_00,
        tokensIn:  100_000,
        tokensOut: 500_000, // 5× ratio
        requests: 50,
      }],
      providerList: [{ id: "p-openai", name: "openai", displayName: "OpenAI" }],
    });

    const body = await (await GET(makeReq())).json();
    const highOutput = body.recommendations.find(
      (r: { type: string }) => r.type === "high_output_ratio",
    );
    expect(highOutput).toBeDefined();
  });

  it("caps recommendations at 5", async () => {
    // 6 expensive opus rows → at most 5 recs returned
    setupMocks({
      models: Array.from({ length: 6 }, (_, i) => ({
        providerId: "p-anthropic",
        model: `claude-opus-4-8`,
        cost: 20_000_00,
        tokensIn:  500_000,
        tokensOut: 200_000,
        requests: 100 + i,
      })),
      providerList: [{ id: "p-anthropic", name: "anthropic", displayName: "Anthropic" }],
    });

    const body = await (await GET(makeReq())).json();
    expect(body.recommendations.length).toBeLessThanOrEqual(5);
  });

  it("returns empty recommendations when no data", async () => {
    setupMocks();
    const body = await (await GET(makeReq())).json();
    expect(body.recommendations).toHaveLength(0);
    expect(body.potentialSavingsCents).toBe(0);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: () => ({ API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64") }),
}));

const mockFindUnique  = vi.fn();
const mockAggregate   = vi.fn();
const mockCount       = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    agent:    { findUnique: (...a: unknown[]) => mockFindUnique(...a) },
    usageLog: {
      aggregate: (...a: unknown[]) => mockAggregate(...a),
      count:     (...a: unknown[]) => mockCount(...a),
    },
  },
}));

import { checkAgentPolicy } from "@/lib/proxy/policy-engine";
import { __resetRateLimitStore } from "@/lib/rate-limit";

afterEach(() => {
  vi.resetAllMocks();
  __resetRateLimitStore();
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const activeAgent = (overrides = {}) => ({
  id: "agent-1",
  status: "active",
  policyAssignments: [],
  ...overrides,
});

const blockPolicy = (rules: { type: string; value: unknown }[]) => ({
  policy: {
    id: "policy-1",
    isActive: true,
    severity: "block",
    ruleDefinition: rules,
  },
});

// ---------------------------------------------------------------------------

describe("checkAgentPolicy - agent not found", () => {
  it("returns 404 when agent does not exist", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const result = await checkAgentPolicy("missing", null, "POST", null);
    expect(result).toMatchObject({ allowed: false, statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------

describe("checkAgentPolicy - agent status kill-switch", () => {
  it("blocks when agent status is paused", async () => {
    mockFindUnique.mockResolvedValueOnce(activeAgent({ status: "paused" }));
    const result = await checkAgentPolicy("agent-1", null, "POST", null);
    expect(result).toMatchObject({ allowed: false, statusCode: 403 });
    expect((result as { reason: string }).reason).toMatch(/paused/);
  });

  it("blocks when agent status is deactivated", async () => {
    mockFindUnique.mockResolvedValueOnce(activeAgent({ status: "deactivated" }));
    const result = await checkAgentPolicy("agent-1", null, "POST", null);
    expect(result).toMatchObject({ allowed: false, statusCode: 403 });
  });

  it("allows when agent status is active with no policies", async () => {
    mockFindUnique.mockResolvedValueOnce(activeAgent());
    const result = await checkAgentPolicy("agent-1", null, "POST", null);
    expect(result).toMatchObject({ allowed: true });
  });
});

// ---------------------------------------------------------------------------

describe("checkAgentPolicy - KILL_SWITCH rule", () => {
  it("blocks when KILL_SWITCH rule value is false", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy([{ type: "KILL_SWITCH", value: false }])] }),
    );
    const result = await checkAgentPolicy("agent-1", null, "POST", null);
    expect(result).toMatchObject({ allowed: false, statusCode: 403 });
  });

  it("allows when KILL_SWITCH rule value is true", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy([{ type: "KILL_SWITCH", value: true }])] }),
    );
    const result = await checkAgentPolicy("agent-1", null, "POST", null);
    expect(result).toMatchObject({ allowed: true });
  });
});

// ---------------------------------------------------------------------------

describe("checkAgentPolicy - MODEL_WHITELIST", () => {
  const whitelist = [{ type: "MODEL_WHITELIST", value: ["gpt-4o", "gpt-4o-mini"] }];

  it("allows a whitelisted model", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(whitelist)] }),
    );
    const result = await checkAgentPolicy("agent-1", "gpt-4o", "POST", {});
    expect(result).toMatchObject({ allowed: true });
  });

  it("blocks a model not on the whitelist", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(whitelist)] }),
    );
    const result = await checkAgentPolicy("agent-1", "o3", "POST", {});
    expect(result).toMatchObject({ allowed: false, statusCode: 403 });
    expect((result as { reason: string }).reason).toMatch(/o3/);
  });

  it("skips model check when model is null (non-completion request)", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(whitelist)] }),
    );
    const result = await checkAgentPolicy("agent-1", null, "GET", null);
    expect(result).toMatchObject({ allowed: true });
  });
});

// ---------------------------------------------------------------------------

describe("checkAgentPolicy - MODEL_BLACKLIST", () => {
  const blacklist = [{ type: "MODEL_BLACKLIST", value: ["o1", "o3"] }];

  it("blocks a blacklisted model", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(blacklist)] }),
    );
    const result = await checkAgentPolicy("agent-1", "o1", "POST", {});
    expect(result).toMatchObject({ allowed: false, statusCode: 403 });
  });

  it("allows a model not on the blacklist", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(blacklist)] }),
    );
    const result = await checkAgentPolicy("agent-1", "gpt-4o", "POST", {});
    expect(result).toMatchObject({ allowed: true });
  });
});

// ---------------------------------------------------------------------------

describe("checkAgentPolicy - SPEND_CAP_MONTHLY", () => {
  const spendCapRule = [{ type: "SPEND_CAP_MONTHLY", value: 10000 }]; // $100

  it("blocks when month-to-date spend meets or exceeds cap", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(spendCapRule)] }),
    );
    mockAggregate.mockResolvedValueOnce({ _sum: { costCents: 10000 } });

    const result = await checkAgentPolicy("agent-1", null, "POST", null);
    expect(result).toMatchObject({ allowed: false, statusCode: 403 });
    expect((result as { reason: string }).reason).toMatch(/cap exceeded/);
  });

  it("allows when spend is below cap", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(spendCapRule)] }),
    );
    mockAggregate.mockResolvedValueOnce({ _sum: { costCents: 9999 } });

    const result = await checkAgentPolicy("agent-1", null, "POST", null);
    expect(result).toMatchObject({ allowed: true });
  });

  it("allows when no spend logged yet (null sum)", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(spendCapRule)] }),
    );
    mockAggregate.mockResolvedValueOnce({ _sum: { costCents: null } });

    const result = await checkAgentPolicy("agent-1", null, "POST", null);
    expect(result).toMatchObject({ allowed: true });
  });
});

// ---------------------------------------------------------------------------

describe("checkAgentPolicy - RATE_LIMIT (in-memory)", () => {
  const rule = (rpm: number) => [{ type: "RATE_LIMIT", value: { requestsPerMinute: rpm } }];

  it("allows up to the limit then blocks further requests in the window", async () => {
    mockFindUnique.mockResolvedValue(
      activeAgent({ id: "agent-rl-1", policyAssignments: [blockPolicy(rule(3))] }),
    );

    for (let i = 0; i < 3; i++) {
      const ok = await checkAgentPolicy("agent-rl-1", null, "POST", null);
      expect(ok).toMatchObject({ allowed: true });
    }

    const blocked = await checkAgentPolicy("agent-rl-1", null, "POST", null);
    expect(blocked).toMatchObject({ allowed: false, statusCode: 429 });
    expect((blocked as { reason: string }).reason).toMatch(/Rate limit/);
  });

  it("tracks limits per agent independently", async () => {
    mockFindUnique.mockResolvedValue(
      activeAgent({ id: "agent-rl-2", policyAssignments: [blockPolicy(rule(1))] }),
    );

    expect(await checkAgentPolicy("agent-rl-2", null, "POST", null)).toMatchObject({ allowed: true });
    expect(await checkAgentPolicy("agent-rl-2", null, "POST", null)).toMatchObject({ allowed: false, statusCode: 429 });
    // A different agent has its own bucket.
    mockFindUnique.mockResolvedValue(
      activeAgent({ id: "agent-rl-3", policyAssignments: [blockPolicy(rule(1))] }),
    );
    expect(await checkAgentPolicy("agent-rl-3", null, "POST", null)).toMatchObject({ allowed: true });
  });
});

// ---------------------------------------------------------------------------

describe("checkAgentPolicy - DATA_ACCESS", () => {
  const dataRule = [{ type: "DATA_ACCESS", value: ["refund", "delete_all"] }];

  it("blocks request body containing a disallowed pattern", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(dataRule)] }),
    );
    const body = { messages: [{ role: "user", content: "process refund for order 123" }] };
    const result = await checkAgentPolicy("agent-1", "gpt-4o", "POST", body);
    expect(result).toMatchObject({ allowed: false, statusCode: 403 });
    expect((result as { reason: string }).reason).toMatch(/refund/);
  });

  it("allows clean request body", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({ policyAssignments: [blockPolicy(dataRule)] }),
    );
    const body = { messages: [{ role: "user", content: "summarise this document" }] };
    const result = await checkAgentPolicy("agent-1", "gpt-4o", "POST", body);
    expect(result).toMatchObject({ allowed: true });
  });
});

// ---------------------------------------------------------------------------

describe("checkAgentPolicy - non-block severity is ignored", () => {
  it("warning severity does not block the request", async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeAgent({
        policyAssignments: [{
          policy: {
            id: "p2",
            isActive: true,
            severity: "warning",
            ruleDefinition: [{ type: "KILL_SWITCH", value: false }],
          },
        }],
      }),
    );
    const result = await checkAgentPolicy("agent-1", null, "POST", null);
    expect(result).toMatchObject({ allowed: true });
  });
});

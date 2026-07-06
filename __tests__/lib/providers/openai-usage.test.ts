import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the OpenAI usage sync cost attribution.
 *
 * The core invariant: incremental syncs must NOT re-distribute a whole day's
 * billed cost across their small trailing window. Doing so re-records (almost)
 * the entire daily spend on every cron run, inflating stored cost by a large
 * factor. Incremental syncs must fall back to per-bucket token-based estimates.
 */

// Capture every usage-log write so we can assert on the persisted cost.
const createdLogs: Array<Record<string, unknown>> = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    connectedAgent: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    connectedAgentUsageLog: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        createdLogs.push(args.data);
        return Promise.resolve({ id: "log" });
      }),
    },
    providerAdminKey: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decryptApiKey: vi.fn(() => "sk-admin-test"),
}));

vi.stubGlobal("fetch", vi.fn());

import { prisma } from "@/lib/db";
import { syncOpenAIUsage } from "@/lib/providers/openai-usage";
import { calculateCostCents } from "@/lib/providers/pricing";

// A UTC-midnight day start (seconds), so dayStartUnix() is a no-op on it and the
// usage bucket start_time lines up with the daily Costs API bucket start_time.
const DAY_START = Math.floor(Date.UTC(2026, 5, 1, 0, 0, 0) / 1000);

const AGENT = {
  id: "agent-1",
  status: "active",
  metadata: {},
  connectedAt: new Date("2026-05-01T00:00:00Z"),
};

function usageResponse(startTime: number, tokensIn: number, tokensOut: number) {
  return new Response(
    JSON.stringify({
      data: [
        {
          start_time: startTime,
          results: [
            {
              input_tokens: tokensIn,
              output_tokens: tokensOut,
              num_model_requests: 3,
              project_id: "proj-1",
              model: "gpt-4o",
            },
          ],
        },
      ],
    }),
    { status: 200 },
  );
}

function costsResponse(startTime: number, usdValue: number) {
  return new Response(
    JSON.stringify({
      data: [
        { start_time: startTime, results: [{ amount: { value: usdValue }, project_id: "proj-1" }] },
      ],
    }),
    { status: 200 },
  );
}

beforeEach(() => {
  createdLogs.length = 0;
  vi.mocked(prisma.connectedAgent.findMany).mockResolvedValue([AGENT] as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("syncOpenAIUsage cost attribution", () => {
  it("first sync distributes the real billed daily cost across the day's buckets", async () => {
    // First sync: one full-day bucket + a matching daily cost of $12.34.
    vi.mocked(fetch)
      .mockResolvedValueOnce(usageResponse(DAY_START, 1000, 500)) // usage
      .mockResolvedValueOnce(costsResponse(DAY_START, 12.34)); // costs

    const adminKey = {
      id: "key-1",
      encryptedKey: "enc",
      providerId: "prov-1",
      lastSyncedAt: null, // first sync
      metadata: {},
    };

    const result = await syncOpenAIUsage("company-1", adminKey as never);

    expect(result.logsCreated).toBe(1);
    // Single bucket owns the whole day, so it receives the full billed cost.
    expect(Number(createdLogs[0].costCents)).toBeCloseTo(1234, 5);
    // Two fetches: usage + costs.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("incremental sync does NOT re-attribute the whole-day cost to its window", async () => {
    // Incremental window has only 150 tokens, but the Costs API would report the
    // full accrued day cost ($99.99). The old code divided that full cost by the
    // window's tiny token count and re-recorded it on every run. After the fix,
    // incremental syncs never call the Costs API and price each bucket from its
    // own tokens instead.
    const minuteBucket = DAY_START + 12 * 3600; // some minute inside the day
    vi.mocked(fetch).mockResolvedValueOnce(usageResponse(minuteBucket, 100, 50));

    const adminKey = {
      id: "key-1",
      encryptedKey: "enc",
      providerId: "prov-1",
      lastSyncedAt: new Date(), // not the first sync
      metadata: {},
    };

    const result = await syncOpenAIUsage("company-1", adminKey as never);

    expect(result.logsCreated).toBe(1);

    const persistedCost = Number(createdLogs[0].costCents);
    const tokenEstimate = calculateCostCents("openai", "gpt-4o", 100, 50);

    // Cost must be the per-bucket token estimate, NOT a re-attributed daily total.
    expect(persistedCost).toBeCloseTo(tokenEstimate, 5);
    // The Costs API must not be queried on incremental syncs (only the usage fetch).
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the Anthropic usage sync window.
 *
 * The core invariant: incremental syncs must anchor their lookback window to
 * lastSyncedAt (minus a small safety buffer), NOT to a fixed trailing window.
 * The scheduling job fires ~every 60-90 minutes in practice, so a fixed
 * 60-minute lookback would leave the usage accrued between
 * (lastSyncedAt, now-60min) outside every fetch window and silently drop it.
 */

vi.mock("@/lib/db", () => ({
  prisma: {
    connectedAgent: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    connectedAgentUsageLog: {
      create: vi.fn().mockResolvedValue({ id: "log" }),
    },
    providerAdminKey: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decryptApiKey: vi.fn(() => "sk-ant-admin-test"),
}));

vi.stubGlobal("fetch", vi.fn());

import { syncAnthropicUsage } from "@/lib/providers/anthropic-usage";

function emptyUsageResponse() {
  return new Response(JSON.stringify({ data: [] }), { status: 200 });
}

/** Pull the `starting_at` query param out of the URL passed to fetch. */
function fetchedStartingAt(): Date {
  const call = vi.mocked(fetch).mock.calls[0];
  const url = new URL(String(call[0]));
  return new Date(url.searchParams.get("starting_at")!);
}

function fetchedBucketWidth(): string {
  const call = vi.mocked(fetch).mock.calls[0];
  return new URL(String(call[0])).searchParams.get("bucket_width")!;
}

beforeEach(() => {
  vi.mocked(fetch).mockResolvedValue(emptyUsageResponse());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("syncAnthropicUsage window", () => {
  it("first sync backfills ~30 days with daily buckets", async () => {
    const now = Date.now();
    const adminKey = {
      id: "key-1",
      encryptedKey: "enc",
      providerId: "prov-1",
      lastSyncedAt: null,
      metadata: {},
    };

    await syncAnthropicUsage("company-1", adminKey as never);

    const startedDaysAgo = (now - fetchedStartingAt().getTime()) / (24 * 60 * 60 * 1000);
    expect(startedDaysAgo).toBeGreaterThan(29);
    expect(startedDaysAgo).toBeLessThan(31);
    expect(fetchedBucketWidth()).toBe("1d");
  });

  it("incremental sync anchors the window to lastSyncedAt, covering long cron gaps", async () => {
    // Last sync was 90 minutes ago — larger than the old fixed 60-minute window.
    const lastSyncedAt = new Date(Date.now() - 90 * 60 * 1000);
    const adminKey = {
      id: "key-1",
      encryptedKey: "enc",
      providerId: "prov-1",
      lastSyncedAt,
      metadata: {},
    };

    await syncAnthropicUsage("company-1", adminKey as never);

    // Window must start at lastSyncedAt minus the 15-minute buffer (±a few
    // seconds), NOT at now-60min which would drop the first 30 minutes.
    const expectedStart = lastSyncedAt.getTime() - 15 * 60 * 1000;
    const actualStart = fetchedStartingAt().getTime();
    expect(Math.abs(actualStart - expectedStart)).toBeLessThan(5_000);

    // The gap (105 min) is under a day, so minute buckets are used.
    expect(fetchedBucketWidth()).toBe("1m");
  });
});

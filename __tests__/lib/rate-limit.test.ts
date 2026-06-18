import { afterEach, describe, expect, it, vi } from "vitest";
import {
  rateLimit,
  rateLimitByIp,
  getClientIp,
  tooManyRequests,
  __resetRateLimitStore,
} from "@/lib/rate-limit";

afterEach(() => {
  __resetRateLimitStore();
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks", () => {
    const key = "test:1";
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("reports remaining count accurately", () => {
    expect(rateLimit("test:rem", 5, 60_000).remaining).toBe(4);
    expect(rateLimit("test:rem", 5, 60_000).remaining).toBe(3);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const key = "test:window";
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
    expect(rateLimit(key, 1, 1_000).ok).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
  });

  it("isolates separate keys", () => {
    expect(rateLimit("test:a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("test:b", 1, 60_000).ok).toBe(true);
  });
});

describe("getClientIp", () => {
  it("takes the first IP from x-forwarded-for", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip then 'unknown'", () => {
    expect(getClientIp(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
    expect(getClientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("rateLimitByIp + tooManyRequests", () => {
  it("scopes buckets by ip and returns a 429 with Retry-After", async () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1" } });
    expect(rateLimitByIp(req, { scope: "audits", limit: 1, windowMs: 60_000 }).ok).toBe(true);
    const blocked = rateLimitByIp(req, { scope: "audits", limit: 1, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);

    const res = tooManyRequests(blocked.retryAfterSec);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = await res.json();
    expect(body.error.code).toBe("rate_limited");
  });
});

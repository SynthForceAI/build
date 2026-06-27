import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: () => ({
    API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64"),
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
  }),
}));

const mockUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    waitlistSignup: { upsert: (...args: unknown[]) => mockUpsert(...args) },
  },
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitByIp: vi.fn().mockReturnValue({ ok: true, remaining: 9, retryAfterSec: 0 }),
  };
});

import { POST } from "@/app/api/waitlist/route";
import { NextRequest } from "next/server";
import { __resetRateLimitStore, rateLimitByIp } from "@/lib/rate-limit";

const mockRateLimitByIp = vi.mocked(rateLimitByIp);

afterEach(() => {
  vi.clearAllMocks();
  mockRateLimitByIp.mockReturnValue({ ok: true, remaining: 9, retryAfterSec: 0 });
  __resetRateLimitStore();
});

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/waitlist", () => {
  it("creates a waitlist signup with normalized email", async () => {
    mockUpsert.mockResolvedValue({ id: "uuid", email: "jane@acme.com" });

    const res = await POST(makeReq({
      email: "Jane@Acme.com",
      name: "Jane Smith",
      company: "Acme Inc.",
      role: "CTO",
      source: "/product",
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { email: "jane@acme.com" },
      create: {
        email: "jane@acme.com",
        name: "Jane Smith",
        company: "Acme Inc.",
        role: "CTO",
        source: "/product",
      },
      update: {
        name: "Jane Smith",
        company: "Acme Inc.",
        role: "CTO",
        source: "/product",
      },
    });
  });

  it("rejects invalid email with 400", async () => {
    const res = await POST(makeReq({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects unknown fields via strict schema", async () => {
    const res = await POST(makeReq({ email: "jane@acme.com", hacker: true }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

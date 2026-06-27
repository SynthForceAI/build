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

const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockLogActivity = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/activity-logs", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitByIp: vi.fn().mockReturnValue({ ok: true, remaining: 9, retryAfterSec: 0 }),
  };
});

import { POST } from "@/app/api/auth/login/route";
import { NextRequest } from "next/server";
import { __resetRateLimitStore, rateLimitByIp } from "@/lib/rate-limit";

const mockRateLimitByIp = vi.mocked(rateLimitByIp);

afterEach(() => {
  vi.clearAllMocks();
  mockRateLimitByIp.mockReturnValue({ ok: true, remaining: 9, retryAfterSec: 0 });
  __resetRateLimitStore();
});

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("rejects unverified users with email_not_verified", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "jane@acme.com",
          email_confirmed_at: null,
        },
      },
      error: null,
    });

    const res = await POST(makeReq({ email: "jane@acme.com", password: "password123" }));
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.code).toBe("email_not_verified");
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("allows verified users to log in", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          email: "owner@acme.com",
          email_confirmed_at: "2026-01-01T00:00:00.000Z",
        },
      },
      error: null,
    });
    mockFindUnique.mockResolvedValue({ id: "user-2", email: "owner@acme.com" });
    mockUpdate.mockResolvedValue({ id: "user-2", email: "owner@acme.com" });

    const res = await POST(makeReq({ email: "owner@acme.com", password: "password123" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.email).toBe("owner@acme.com");
    expect(mockLogActivity).toHaveBeenCalledWith("user-2", "login", {
      method: "email_password",
    });
  });
});

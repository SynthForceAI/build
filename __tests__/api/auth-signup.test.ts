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

const mockSignUp = vi.fn();
const mockLogActivity = vi.fn();
const mockProvisionNewUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  })),
}));

vi.mock("@/lib/auth/provision-user", () => ({
  provisionNewUser: (...args: unknown[]) => mockProvisionNewUser(...args),
}));

vi.mock("@/lib/activity-logs", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitByIp: vi.fn().mockReturnValue({ ok: true, remaining: 4, retryAfterSec: 0 }),
  };
});

import { POST } from "@/app/api/auth/signup/route";
import { NextRequest } from "next/server";
import { __resetRateLimitStore, rateLimitByIp } from "@/lib/rate-limit";

const mockRateLimitByIp = vi.mocked(rateLimitByIp);

afterEach(() => {
  vi.clearAllMocks();
  mockRateLimitByIp.mockReturnValue({ ok: true, remaining: 4, retryAfterSec: 0 });
  __resetRateLimitStore();
});

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  it("returns needsEmailVerification when Supabase does not create a session", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "jane@acme.com" },
        session: null,
      },
      error: null,
    });

    const res = await POST(makeReq({ email: "jane@acme.com", password: "password123" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({
      needsEmailVerification: true,
      email: "jane@acme.com",
    });

    expect(mockProvisionNewUser).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "jane@acme.com",
      password: "password123",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });
  });

  it("provisions the account immediately when Supabase returns a session", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-2", email: "owner@acme.com" },
        session: { access_token: "token" },
      },
      error: null,
    });
    mockProvisionNewUser.mockResolvedValue({ id: "user-2", email: "owner@acme.com" });

    const res = await POST(makeReq({ email: "owner@acme.com", password: "password123" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ id: "user-2", email: "owner@acme.com" });
    expect(mockProvisionNewUser).toHaveBeenCalledWith({
      id: "user-2",
      email: "owner@acme.com",
    });
    expect(mockLogActivity).toHaveBeenCalledWith("user-2", "signup", {
      method: "email_password",
    });
  });
});

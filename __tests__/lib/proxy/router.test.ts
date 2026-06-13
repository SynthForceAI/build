import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: () => ({
    API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64"),
  }),
}));

// Mock identifyAgent so router tests don't touch the DB
vi.mock("@/lib/proxy/middleware/identify-agent", () => ({
  identifyAgent: vi.fn(),
}));

vi.stubGlobal("fetch", vi.fn());

import { routeProxyRequest } from "@/lib/proxy/router";
import { identifyAgent } from "@/lib/proxy/middleware/identify-agent";

const mockIdentify = vi.mocked(identifyAgent);
const mockFetch    = vi.mocked(fetch);

const OPENAI_CONTEXT = {
  agentId:            "agent-1",
  providerId:         "provider-openai",
  providerName:       "openai",
  providerApiBaseUrl: "https://api.openai.com/v1",
  providerApiKey:     "sk-real-openai",
  requestId:          "req-1",
  timestamp:          new Date(),
};

const ANTHROPIC_CONTEXT = {
  ...OPENAI_CONTEXT,
  providerName:       "anthropic",
  providerApiBaseUrl: "https://api.anthropic.com/v1",
  providerApiKey:     "sk-ant-real",
};

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------

describe("routeProxyRequest — auth", () => {
  it("throws 401 when no virtual key provided", async () => {
    mockIdentify.mockResolvedValueOnce(null);

    await expect(
      routeProxyRequest("openai", "/v1/models", "GET", new Headers(), null),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("throws 400 when virtual key is for a different provider", async () => {
    mockIdentify.mockResolvedValueOnce(ANTHROPIC_CONTEXT);

    await expect(
      routeProxyRequest("openai", "/v1/models", "GET", new Headers({ authorization: "Bearer sf-key-x" }), null),
    ).rejects.toMatchObject({ code: "provider_mismatch" });
  });
});

// ---------------------------------------------------------------------------

describe("routeProxyRequest — OpenAI forwarding", () => {
  it("forwards with Authorization: Bearer header and returns upstream response", async () => {
    mockIdentify.mockResolvedValueOnce(OPENAI_CONTEXT);
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ object: "list" }), { status: 200 }));

    const { response } = await routeProxyRequest(
      "openai",
      "/v1/models",
      "GET",
      new Headers({ authorization: "Bearer sf-key-abc" }),
      null,
    );

    expect(response.status).toBe(200);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe("https://api.openai.com/v1/v1/models");
    expect((init.headers as Headers).get("authorization")).toBe("Bearer sk-real-openai");
    expect((init.headers as Headers).get("x-api-key")).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("routeProxyRequest — Anthropic forwarding", () => {
  it("uses x-api-key header and injects anthropic-version", async () => {
    mockIdentify.mockResolvedValueOnce(ANTHROPIC_CONTEXT);
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await routeProxyRequest(
      "anthropic",
      "/v1/messages",
      "POST",
      new Headers({ authorization: "Bearer sf-key-abc", "content-type": "application/json" }),
      null,
    );

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(url).toBe("https://api.anthropic.com/v1/v1/messages");
    expect((init.headers as Headers).get("x-api-key")).toBe("sk-ant-real");
    expect((init.headers as Headers).get("authorization")).toBeNull();
    expect((init.headers as Headers).get("anthropic-version")).toBe("2023-06-01");
  });
});

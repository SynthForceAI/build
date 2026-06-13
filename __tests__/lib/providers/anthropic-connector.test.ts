import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAnthropicKey, verifyAnthropicAdminKey, resolveAnthropicKeyId} from "@/lib/providers/anthropic-connector";

// Replace the real global fetch with a controllable fake for every test
vi.stubGlobal("fetch", vi.fn());

afterEach(() => {
  vi.resetAllMocks(); // wipes the mock's memory between tests so they don't bleed into each other
});

describe("verifyAnthropicKey", () => {
  it("should return model IDs on a valid key", async () => {
    // Tell fetch: next time you're called, pretend the server returned this
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [{ id: "claude-opus-4-8" }, { id: "claude-sonnet-4-6" }] }),
        { status: 200 }
      )
    );

    const result = await verifyAnthropicKey("sk-ant-validkey");

    expect(result).toContain("claude-opus-4-8");
    expect(result).toContain("claude-sonnet-4-6");
  });

  it("should throw on a 401 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );

    await expect(verifyAnthropicKey("sk-ant-invalid")).rejects.toThrow(
      "Anthropic rejected the API key (401 Unauthorized)"
    );
  });
});

describe("verifyAnthropicAdminKey", () => {
  it("should return empty array on a valid admin key", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 200 })
    );

    const result = await verifyAnthropicAdminKey("sk-ant-admin-validkey");

    expect(result).toEqual([]);
  });

  it("should throw on a 403 response (key lacks org access)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 403 })
    );

    await expect(verifyAnthropicAdminKey("sk-ant-admin-noaccess")).rejects.toThrow(
      "This key lacks org access (403). Create an Admin key in the Anthropic Console."
    );
  });
})

describe("resolveAnthropicKeyId", () => {
    it("should return the key id when partial_key_hint matches fingerprint", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { id: "apikey_01abc", partial_key_hint: "sk-ant-api03-R2D...igAA" },
              { id: "apikey_02xyz", partial_key_hint: "sk-ant-api03-R2D...ZZZZ" },
            ],
          }),
          { status: 200 }
        )
      );
  
      const result = await resolveAnthropicKeyId("sk-ant-admin-key", "igAA");
  
      expect(result).toBe("apikey_01abc");
    });
  
    it("should return null when no key matches the fingerprint", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "apikey_01abc", partial_key_hint: "sk-ant-api03-R2D...igAA" }],
          }),
          { status: 200 }
        )
      );
  
      const result = await resolveAnthropicKeyId("sk-ant-admin-key", "XXXX");
  
      expect(result).toBeNull();
    });
  
    it("should return null on network failure", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));
  
      const result = await resolveAnthropicKeyId("sk-ant-admin-key", "igAA");
  
      expect(result).toBeNull();
    });
  });
  

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- mocks must be hoisted before any import that touches them ---

vi.mock("@/lib/env", () => ({
  env: () => ({
    API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64"),
  }),
}));

const mockCreate     = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate     = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    agentVirtualKey: {
      create:     (...a: unknown[]) => mockCreate(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update:     (...a: unknown[]) => mockUpdate(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));

import {
  generateVirtualKey,
  lookupVirtualKey,
  rotateVirtualKey,
  revokeVirtualKey,
} from "@/lib/proxy/virtual-keys";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------

describe("generateVirtualKey", () => {
  it("creates a record and returns an sf-key- prefixed string", async () => {
    mockCreate.mockResolvedValueOnce({});

    const key = await generateVirtualKey("agent-1", "provider-1", "sk-real-key");

    expect(key).toMatch(/^sf-key-[0-9a-f]{32}$/);
    expect(mockCreate).toHaveBeenCalledOnce();

    const data = mockCreate.mock.calls[0][0].data;
    expect(data.virtualKey).toBe(key);
    expect(data.agentId).toBe("agent-1");
    expect(data.providerId).toBe("provider-1");
    expect(data.encryptedProviderKey).not.toBe("sk-real-key"); // must be encrypted
  });

  it("generates a different key on each call", async () => {
    mockCreate.mockResolvedValue({});

    const k1 = await generateVirtualKey("a", "p", "key");
    const k2 = await generateVirtualKey("a", "p", "key");
    expect(k1).not.toBe(k2);
  });
});

// ---------------------------------------------------------------------------

describe("lookupVirtualKey", () => {
  const makeRecord = (overrides = {}) => ({
    id: "vk-1",
    agentId: "agent-1",
    providerId: "provider-1",
    isActive: true,
    encryptedProviderKey: "PLACEHOLDER",
    provider: {
      name: "openai",
      apiBaseUrl: "https://api.openai.com/v1",
    },
    ...overrides,
  });

  it("returns null for strings that don't start with sf-key-", async () => {
    const result = await lookupVirtualKey("sk-real-key");
    expect(result).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when record not found", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const result = await lookupVirtualKey("sf-key-abc");
    expect(result).toBeNull();
  });

  it("returns null for inactive keys", async () => {
    mockFindUnique.mockResolvedValueOnce(makeRecord({ isActive: false }));
    mockUpdate.mockResolvedValue({});
    const result = await lookupVirtualKey("sf-key-abc");
    expect(result).toBeNull();
  });

  it("decrypts provider key and returns lookup on valid key", async () => {
    // Encrypt a real value so we can round-trip it
    const { encryptApiKey } = await import("@/lib/crypto");
    const encrypted = encryptApiKey("sk-openai-real");

    mockFindUnique.mockResolvedValueOnce(makeRecord({ encryptedProviderKey: encrypted }));
    mockUpdate.mockResolvedValue({});

    const result = await lookupVirtualKey("sf-key-abc123");

    expect(result).not.toBeNull();
    expect(result!.agentId).toBe("agent-1");
    expect(result!.providerName).toBe("openai");
    expect(result!.providerApiKey).toBe("sk-openai-real");
  });
});

// ---------------------------------------------------------------------------

describe("rotateVirtualKey", () => {
  it("throws 404 when old key not found", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    await expect(rotateVirtualKey("sf-key-old")).rejects.toThrow("not_found");
  });

  it("creates new key and deactivates old one", async () => {
    const { encryptApiKey } = await import("@/lib/crypto");
    mockFindUnique.mockResolvedValueOnce({
      id: "vk-old",
      agentId: "agent-1",
      providerId: "provider-1",
      encryptedProviderKey: encryptApiKey("sk-real"),
    });
    mockCreate.mockResolvedValueOnce({});
    mockUpdate.mockResolvedValueOnce({});

    const newKey = await rotateVirtualKey("sf-key-old");

    expect(newKey).toMatch(/^sf-key-/);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "vk-old" }, data: expect.objectContaining({ isActive: false }) }),
    );
  });
});

// ---------------------------------------------------------------------------

describe("revokeVirtualKey", () => {
  it("sets isActive to false", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    await revokeVirtualKey("sf-key-abc");

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { virtualKey: "sf-key-abc" },
      data: { isActive: false },
    });
  });
});

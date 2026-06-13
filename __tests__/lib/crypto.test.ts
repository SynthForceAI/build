import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
    env: () => ({
      API_KEY_ENCRYPTION_KEY: Buffer.from("a".repeat(32)).toString("base64"),
    }),
}));

import { decryptApiKey, encryptApiKey } from "@/lib/crypto";

describe("Encryption (AES-256-GCM)", () => {
    it("should encrypt and decrypt a key without loss", () => {
      const plaintext = "sk-ant-abc123";
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  
    it("should produce different ciphertexts for the same plaintext (IV variance)", () => {
      const plaintext = "sk-ant-abc123";
      const enc1 = encryptApiKey(plaintext);
      const enc2 = encryptApiKey(plaintext);
      expect(enc1).not.toBe(enc2); // Different IVs
    });
  
    it("should throw on tampered ciphertext", () => {
      const plaintext = "sk-ant-abc123";
      const encrypted = encryptApiKey(plaintext);
      const tampered = encrypted.slice(0, -10) + "corrupted";
      expect(() => decryptApiKey(tampered)).toThrow();
    });
  });

/**
 * AES-256-GCM encryption for customer-provided provider API keys.
 *
 * Storage format (base64-encoded for the DB):
 *
 *     [ 12-byte IV ][ ciphertext ][ 16-byte auth tag ]
 *
 * The master key (API_KEY_ENCRYPTION_KEY) lives in Vercel's encrypted env
 * settings and is never logged. Rotating it requires re-encrypting every
 * ApiKey row — see docs/BACKEND.md "Key rotation."
 *
 * GCM is an AEAD cipher: tampering with any byte of the ciphertext or
 * auth tag causes `decryptApiKey` to throw, which is the property we
 * want for keys whose value is "secret OR error."
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

const ALGO       = "aes-256-gcm";
const IV_LENGTH  = 12;  // GCM standard
const TAG_LENGTH = 16;

function masterKey(): Buffer {
  const raw = Buffer.from(env().API_KEY_ENCRYPTION_KEY, "base64");
  if (raw.length !== 32) {
    throw new Error("API_KEY_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return raw;
}

export function encryptApiKey(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptApiKey: plaintext must be a non-empty string.");
  }
  const iv     = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const ct     = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decryptApiKey(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("decryptApiKey: ciphertext payload is truncated.");
  }
  const iv  = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const ct  = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Last 4 chars of the plaintext key for UI display ("sk-...abc1"). */
export function keyIdentifierFrom(plaintext: string): string {
  return plaintext.slice(-4);
}

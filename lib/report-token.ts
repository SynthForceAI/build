/**
 * Self-report tokens for ConnectedAgents.
 *
 * Each connected agent gets one high-entropy bearer token at connect time.
 * The raw token is returned to the customer exactly once; we persist only its
 * SHA-256 hash (ConnectedAgent.reportTokenHash). On every /report-usage call we
 * hash the presented token and constant-time compare against the stored hash.
 *
 * A plain SHA-256 (not a slow KDF) is appropriate here because the token is
 * 256 bits of CSPRNG output — there is no low-entropy secret to brute force.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX = "sfr_"; // "synthforce report"

/** Generate a new raw report token. Show once, never store in the clear. */
export function generateReportToken(): string {
  return PREFIX + randomBytes(32).toString("base64url");
}

/** SHA-256 hex of a raw token, suitable for storage/lookup. */
export function hashReportToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Constant-time check that a presented token matches a stored hash.
 * Returns false (never throws) for missing/garbage input.
 */
export function verifyReportToken(rawToken: string | null | undefined, storedHash: string | null | undefined): boolean {
  if (!rawToken || !storedHash) return false;
  const presented = Buffer.from(hashReportToken(rawToken), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (presented.length !== stored.length) return false;
  return timingSafeEqual(presented, stored);
}

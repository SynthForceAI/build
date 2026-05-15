/**
 * @module canonicalize
 * @description Deterministic JSON serialization for audit payload hash computation.
 *
 * PROBLEM: JSON.stringify() does NOT guarantee key order. Two objects with identical
 * fields but different insertion order produce different strings → different hashes.
 * This breaks chain verification across: service restarts, Node.js versions,
 * language boundaries, and any future polyglot verifier (Python, Go, etc).
 *
 * SOLUTION: Recursive key sort + strict serialization rules.
 * Compliant with RFC 8785 (JSON Canonical Form) for cross-language interoperability.
 *
 * RULES enforced here:
 *   1. Keys sorted lexicographically (Unicode code point order)
 *   2. No whitespace
 *   3. UTF-8 encoding (Node.js default)
 *   4. Numbers: no -0, no NaN, no Infinity (will throw)
 *   5. undefined values: will throw (must not exist in payload)
 *   6. Dates: must be pre-converted to ISO strings before reaching here
 *   7. Class instances: will throw — plain objects only
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Recursively sorts object keys and produces a deterministic JSON string.
 * Throws on any non-serializable value to surface bugs at write time, not verify time.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value, "$"));
}

function sortKeys(value: unknown, path: string): JsonValue {
  if (value === null) return null;
  if (value === undefined) {
    throw new CanonicalizationError(`undefined value at path '${path}' — remove the field or use null`);
  }

  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalizationError(`non-finite number at path '${path}': ${value}`);
    }
    if (Object.is(value, -0)) {
      throw new CanonicalizationError(`-0 is not allowed at path '${path}' — use 0`);
    }
    return value;
  }

  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    // Arrays: preserve element order (do NOT sort array contents)
    return value.map((item, i) => sortKeys(item, `${path}[${i}]`));
  }

  if (typeof value === "object") {
    // Reject class instances — only plain objects allowed
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new CanonicalizationError(
        `class instance at path '${path}' (${(value as object).constructor?.name}) — serialize to plain object first`
      );
    }

    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort(); // lexicographic, Unicode code point

    const result: JsonObject = {};
    for (const key of sortedKeys) {
      result[key] = sortKeys(obj[key], `${path}.${key}`);
    }
    return result;
  }

  // Functions, Symbols, BigInt, etc.
  throw new CanonicalizationError(
    `unserializable type '${typeof value}' at path '${path}'`
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(`[Canonicalize] ${message}`);
    this.name = "CanonicalizationError";
  }
}

// ─── Verification Helper ──────────────────────────────────────────────────────

/**
 * Parse and re-canonicalize a string to verify it is canonical.
 * Use this in the verifier to ensure S3-retrieved payloads haven't been
 * re-serialized by an intermediate system that doesn't preserve order.
 */
export function assertCanonical(raw: string): void {
  const parsed = JSON.parse(raw);
  const recanon = canonicalize(parsed);
  if (raw !== recanon) {
    throw new CanonicalizationError(
      "string is not in canonical form — key order or formatting has been altered"
    );
  }
}

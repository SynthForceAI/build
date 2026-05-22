/**
 * BigInt + Decimal serialization helpers.
 *
 * JSON.stringify can't serialize BigInt natively, and Prisma's Decimal
 * type isn't a plain number. We expose two helpers that route handlers
 * use to convert DB rows into JSON-safe shapes.
 *
 * For BigInt fields representing cents/tokens, we return numbers when
 * the value fits in Number.MAX_SAFE_INTEGER (2^53 - 1 = ~9e15 cents,
 * i.e. $90 trillion — comfortable for any realistic budget). Anything
 * larger comes back as a string and the client must handle it.
 */
import type { Decimal } from "@prisma/client/runtime/library";

const SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const SAFE_MIN = -SAFE_MAX;

export function bigintToJson(v: bigint): number | string {
  return v >= SAFE_MIN && v <= SAFE_MAX ? Number(v) : v.toString();
}

export function decimalToJson(v: Decimal | null | undefined): number | string | null {
  if (v === null || v === undefined) return null;
  // Prisma Decimal has .toNumber() but we don't want quiet precision loss
  // for usage-log costs that can have many fractional cent digits.
  const s = v.toString();
  const n = Number(s);
  return Number.isFinite(n) && String(n) === s ? n : s;
}

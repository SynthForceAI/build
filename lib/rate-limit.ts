/**
 * Lightweight, dependency-free rate limiting for API route handlers.
 *
 * Implementation: in-memory fixed-window counter keyed by an arbitrary string
 * (typically `${scope}:${clientIp}`). It protects against the common abuse
 * cases - brute-forcing auth and hammering the expensive unauthenticated audit
 * endpoint - without standing up external infrastructure.
 *
 * LIMITATION: state lives in the function instance's memory. On Vercel Fluid
 * Compute, instances are reused and shared across concurrent requests, so this
 * is effective per-instance but NOT a globally-consistent limit across a
 * horizontally-scaled fleet. When stronger guarantees are needed, swap the
 * `store` for a shared backend (e.g. Upstash Redis) behind the same API; no
 * call sites change.
 */
import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

// Keyed by `${scope}:${identifier}`.
const store = new Map<string, Bucket>();

// Opportunistic cleanup so the map can't grow unbounded under key churn.
const MAX_ENTRIES_BEFORE_SWEEP = 10_000;

function sweepExpired(now: number): void {
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key);
  }
}

export type RateLimitOptions = {
  /** Namespace so different endpoints don't share buckets. */
  scope: string;
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets (for the Retry-After header). */
  retryAfterSec: number;
};

/**
 * Best-effort client IP from proxy headers. On Vercel these are set by the
 * platform; `x-forwarded-for` may be a comma-separated list (client first).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Consume one token for `key`. Pure counter; does not read the request. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    if (store.size > MAX_ENTRIES_BEFORE_SWEEP) sweepExpired(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0 };
}

/** Rate limit a request by client IP within a scope. */
export function rateLimitByIp(req: Request, opts: RateLimitOptions): RateLimitResult {
  return rateLimit(`${opts.scope}:${getClientIp(req)}`, opts.limit, opts.windowMs);
}

/** Uniform 429 response matching the app's `{ error: { code, message } }` shape. */
export function tooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: { code: "rate_limited", message: "Too many requests. Please slow down and try again later." } },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSec)) } },
  );
}

/** Test-only: reset all buckets. */
export function __resetRateLimitStore(): void {
  store.clear();
}

/**
 * POST /api/billing/upgrade-request
 *
 * Begins an upgrade to a paid plan. Delegates to the billing provider seam
 * (lib/billing/provider.ts), which either:
 *   - returns a Stripe Checkout URL (when Stripe is configured), or
 *   - records the request for manual follow-up (default, no payments yet).
 *
 * The response shape is stable across both modes: `{ ok, checkoutUrl? }`.
 * It intentionally never changes the company's subscriptionTier directly —
 * that is owned by the Stripe webhook (or a manual admin action), so a free
 * user can't self-grant a paid tier and bypass the one-free-audit moat.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { rateLimitByIp, tooManyRequests } from "@/lib/rate-limit";
import { startUpgrade } from "@/lib/billing/provider";

const UpgradeRequestSchema = z.object({
  tier: z.enum(["starter", "team", "enterprise"]),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, { scope: "billing-upgrade", limit: 10, windowMs: 60 * 60_000 });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  try {
    const { user } = await requireUser();
    const { tier } = UpgradeRequestSchema.parse(await req.json());

    const result = await startUpgrade(user, tier);

    if (result.kind === "checkout") {
      return NextResponse.json({ ok: true, checkoutUrl: result.url });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

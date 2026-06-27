/**
 * POST /api/billing/webhook  — Stripe webhook seam (not yet active).
 *
 * This is where Stripe tells us a subscription started/changed/ended so we can
 * update `company.subscriptionTier`. It is intentionally inert until Stripe is
 * configured, so deploying it now is safe.
 *
 * To activate (future):
 *   1. `npm i stripe` and set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET.
 *   2. Verify the signature with the raw request body:
 *        const sig = req.headers.get("stripe-signature")!;
 *        const event = stripe.webhooks.constructEvent(
 *          await req.text(), sig, env().STRIPE_WEBHOOK_SECRET!,
 *        );
 *   3. On checkout.session.completed / customer.subscription.updated|deleted,
 *      resolve the company (via the Stripe customer id stored by
 *      setStripeCustomerId) and call `applyTierFromWebhook(companyId, tier)`.
 *
 * Note: Stripe signature verification needs the raw body, so do NOT call
 * req.json() before constructEvent — use req.text().
 */
import { NextRequest, NextResponse } from "next/server";
import { isStripeEnabled } from "@/lib/billing/config";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json(
      { error: { code: "billing_disabled", message: "Stripe billing is not configured." } },
      { status: 503 },
    );
  }

  // Stripe is configured but the handler hasn't been implemented yet.
  // See the activation checklist at the top of this file.
  return NextResponse.json(
    { error: { code: "not_implemented", message: "Stripe webhook handler not yet implemented." } },
    { status: 501 },
  );
}

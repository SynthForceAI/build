/**
 * GET    /api/companies/me   - current user's company
 * PATCH  /api/companies/me   - owner/admin update
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { CompanyUpdateSchema } from "@/lib/validators";
import { stripReservedBillingKeys } from "@/lib/billing/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireUser();
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      include: { _count: { select: { users: true, agents: true, departments: true } } },
    });
    return NextResponse.json({ company });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin");
    const data = CompanyUpdateSchema.parse(await request.json());

    // `subscriptionTier` is deliberately not accepted (see CompanyUpdateSchema):
    // the tier is the paywall boundary and is owned by the Stripe webhook / admin
    // path only. A user must never be able to set it on their own company.

    // Settings are a free-form bag, but the billing seam stashes Stripe linkage
    // there (stripeCustomerId / stripeSubscriptionId). Merge into the existing
    // settings and drop billing-owned keys from the incoming payload so a caller
    // can neither clobber their billing linkage nor forge it onto another
    // company's Stripe customer.
    let settingsUpdate: Prisma.InputJsonValue | undefined;
    if (data.settings !== undefined) {
      const existing = await prisma.company.findUniqueOrThrow({
        where: { id: user.companyId },
        select: { settings: true },
      });
      const current = (existing.settings as Record<string, unknown> | null) ?? {};
      const incoming = stripReservedBillingKeys(data.settings as Record<string, unknown>);
      settingsUpdate = { ...current, ...incoming } as Prisma.InputJsonValue;
    }

    const company = await prisma.company.update({
      where: { id: user.companyId },
      data: {
        name:     data.name,
        slug:     data.slug,
        settings: settingsUpdate,
      },
    });
    return NextResponse.json({ company });
  } catch (err) {
    return handleApiError(err);
  }
}

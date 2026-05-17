/**
 * GET    /api/companies/me   — current user's company
 * PATCH  /api/companies/me   — owner/admin update
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { CompanyUpdateSchema } from "@/lib/validators";

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
    const company = await prisma.company.update({
      where: { id: user.companyId },
      data: {
        name:             data.name,
        slug:             data.slug,
        subscriptionTier: data.subscriptionTier,
        settings:         data.settings as object | undefined,
      },
    });
    return NextResponse.json({ company });
  } catch (err) {
    return handleApiError(err);
  }
}

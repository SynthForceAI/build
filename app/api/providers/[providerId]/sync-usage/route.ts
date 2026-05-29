/**
 * GET /api/providers/:providerId/sync-usage
 *
 * On-demand trigger for the same polling the scheduled job runs. Pulls usage
 * from the provider's admin API using the stored ProviderAdminKey, writes
 * usage logs, and flips connected agents pending -> active. Owner/admin only.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { Uuid } from "@/lib/validators";
import { syncProviderUsage } from "@/lib/providers/sync-dispatch";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ providerId: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin");
    const { providerId } = await params;
    Uuid.parse(providerId);

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new ApiError(404, "provider_not_found");

    const adminKey = await prisma.providerAdminKey.findUnique({
      where: { companyId_providerId: { companyId: user.companyId, providerId } },
    });
    if (!adminKey) {
      throw new ApiError(400, "admin_key_not_configured", {
        detail: "No admin key stored for this provider. POST one to /admin-key first.",
      });
    }

    const result = await syncProviderUsage(provider.name, user.companyId, adminKey);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}

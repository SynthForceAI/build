/**
 * POST   /api/providers/:providerId/admin-key  — store/replace org admin key
 * DELETE /api/providers/:providerId/admin-key  — remove it
 *
 * Admin keys (sk-admin-…, sk-ant-admin-…, etc.) let the polling job query a
 * provider's org-level usage API. Encrypted at rest like customer keys.
 * Owner/admin only.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { ProviderAdminKeyCreateSchema, Uuid } from "@/lib/validators";
import { encryptApiKey } from "@/lib/crypto";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ providerId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin");
    const { providerId } = await params;
    Uuid.parse(providerId);

    const provider = await prisma.provider.findFirst({ where: { id: providerId, isActive: true } });
    if (!provider) throw new ApiError(404, "provider_not_found");

    const { adminKey, metadata } = ProviderAdminKeyCreateSchema.parse(await request.json());
    const encryptedKey = encryptApiKey(adminKey);

    const saved = await prisma.providerAdminKey.upsert({
      where:  { companyId_providerId: { companyId: user.companyId, providerId } },
      create: { companyId: user.companyId, providerId, encryptedKey, metadata: (metadata ?? {}) as object },
      update: { encryptedKey, metadata: (metadata ?? {}) as object },
    });

    return NextResponse.json(
      { id: saved.id, providerId, provider: provider.name, configured: true, lastSyncedAt: saved.lastSyncedAt },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin");
    const { providerId } = await params;
    Uuid.parse(providerId);

    await prisma.providerAdminKey.deleteMany({ where: { companyId: user.companyId, providerId } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}

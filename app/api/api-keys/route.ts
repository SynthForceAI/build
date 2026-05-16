/**
 * GET   /api/api-keys  — list stored provider API keys (metadata only, never raw)
 * POST  /api/api-keys  — store a new provider API key (owner/admin)
 *
 * The plaintext key NEVER leaves the database server-side process.
 * Responses include only { id, providerId, label, keyIdentifier, createdAt }.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { ApiKeyCreateSchema } from "@/lib/validators";
import { encryptApiKey, keyIdentifierFrom } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// Strip encryptedKey before returning to caller.
function publicShape<T extends { encryptedKey: string }>(k: T) {
  const { encryptedKey: _ignored, ...rest } = k;
  return rest;
}

export async function GET() {
  try {
    const { user } = await requireUser();
    const rows = await prisma.apiKey.findMany({
      where:   { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: { provider: { select: { id: true, name: true, displayName: true } } },
    });
    return NextResponse.json({ apiKeys: rows.map(publicShape) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    requireRole(user, "owner", "admin");
    const data = ApiKeyCreateSchema.parse(await request.json());

    const provider = await prisma.provider.findUnique({ where: { id: data.providerId } });
    if (!provider) throw new ApiError(400, "provider_not_found");

    const encrypted = encryptApiKey(data.apiKey);
    const created = await prisma.apiKey.create({
      data: {
        companyId:     user.companyId,
        providerId:    data.providerId,
        label:         data.label,
        encryptedKey:  encrypted,
        keyIdentifier: keyIdentifierFrom(data.apiKey),
      },
      include: { provider: { select: { id: true, name: true, displayName: true } } },
    });
    return NextResponse.json({ apiKey: publicShape(created) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

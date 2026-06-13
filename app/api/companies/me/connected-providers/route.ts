/**
 * GET /api/companies/me/connected-providers
 *
 * Lists all providers that have an active admin key for the caller's company,
 * plus a fingerprint of the stored key for display in settings.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { decryptApiKey } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireUser();

    const adminKeys = await prisma.providerAdminKey.findMany({
      where: { companyId: user.companyId },
      include: { provider: { select: { id: true, name: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    });

    const connected = adminKeys.map((k) => {
      // Decrypt just to get last 6 chars as fingerprint (never send the full key)
      let fingerprint = "•••••";
      try {
        const plain = decryptApiKey(k.encryptedKey);
        fingerprint = "…" + plain.slice(-6);
      } catch {
        // Decryption failure → show placeholder
      }

      return {
        providerId:  k.providerId,
        providerName: k.provider.name,
        displayName: k.provider.displayName,
        fingerprint,
        connectedAt: k.createdAt.toISOString(),
        lastSyncedAt: k.lastSyncedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ connected });
  } catch (err) {
    return handleApiError(err);
  }
}

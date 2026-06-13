import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!apiKey) {
      throw new ApiError(404, "not_found", { detail: "API key not found." });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Soft-delete all connected agents using this key
      await tx.connectedAgent.updateMany({
        where: { apiKeyId: id, deletedAt: null },
        data:  { deletedAt: now },
      });

      // Pause all agents using this key
      await tx.agent.updateMany({
        where: { apiKeyId: id },
        data:  { status: "paused" },
      });

      // Remove the provider admin key if it was sourced from this api key
      await tx.providerAdminKey.deleteMany({
        where: {
          companyId:  user.companyId,
          providerId: apiKey.providerId,
          metadata:   { path: ["sourceApiKeyId"], equals: id },
        },
      });

      // Wipe key material and mark deleted. Row is retained for FK
      // integrity with any audit records referencing this key.
      await tx.apiKey.update({
        where: { id },
        data: {
          encryptedKey: "",
          isActive:     false,
          deletedAt:    now,
          label:        `${apiKey.label ?? ""}__revoked_${now.getTime()}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

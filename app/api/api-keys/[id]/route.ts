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

    const agent = await prisma.connectedAgent.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!agent) {
      throw new ApiError(404, "not_found", { detail: "Connected agent not found." });
    }

    const now = new Date();

    await prisma.connectedAgent.update({
      where: { id },
      data:  { deletedAt: now },
    });

    // Soft-delete the ApiKey too
    await prisma.apiKey.update({
      where: { id: agent.apiKeyId },
      data:  { deletedAt: now, isActive: false },
    });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}

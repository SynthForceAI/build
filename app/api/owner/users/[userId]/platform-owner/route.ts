import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner, isPrimaryOwner } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { OWNER_EMAIL } from "@/lib/constants";

const PatchSchema = z.object({
  grant: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireOwner();
    const { userId } = await params;
    const { grant } = PatchSchema.parse(await req.json());

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!target) return NextResponse.json({ error: { message: "User not found" } }, { status: 404 });

    // The primary owner's access can never be revoked by anyone.
    if (!grant && target.email === OWNER_EMAIL) {
      throw new ApiError(403, "cannot_revoke_primary_owner", {
        detail: "The primary owner's access cannot be revoked.",
      });
    }

    // Only the primary owner (samarth@synthforceai.com) can revoke owner access.
    // Granted owners can grant others but cannot revoke anyone.
    if (!grant && !isPrimaryOwner(ctx.user.email)) {
      throw new ApiError(403, "revoke_requires_primary_owner", {
        detail: "Only the primary owner can revoke platform owner access.",
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isPlatformOwner: grant },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

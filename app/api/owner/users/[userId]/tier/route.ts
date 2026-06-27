import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";

const PatchSchema = z.object({
  tier: z.enum(["free", "starter", "team", "enterprise"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireOwner();
    const { userId } = await params;
    const { tier } = PatchSchema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!user) return NextResponse.json({ error: { message: "User not found" } }, { status: 404 });

    await prisma.company.update({
      where: { id: user.companyId },
      data: { subscriptionTier: tier },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

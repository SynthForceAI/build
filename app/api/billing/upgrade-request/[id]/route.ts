import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";

const PatchSchema = z.object({
  status: z.enum(["pending", "contacted", "converted", "closed"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const { id } = await params;
    const { status } = PatchSchema.parse(await req.json());
    await prisma.upgradeRequest.update({ where: { id }, data: { status } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

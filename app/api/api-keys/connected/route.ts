import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireUser();

    const agents = await prisma.connectedAgent.findMany({
      where:   { companyId: user.companyId, deletedAt: null },
      orderBy: { connectedAt: "desc" },
      include: { department: { select: { name: true } } },
    });

    return NextResponse.json({
      agents: agents.map((a) => ({
        id:             a.id,
        name:           a.name,
        providerName:   a.providerName,
        modelUsed:      a.modelUsed,
        status:         a.status,
        tasksMonitored: a.tasksMonitored,
        connectedAt:    a.connectedAt,
        department:     a.department?.name ?? null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

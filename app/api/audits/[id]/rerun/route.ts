import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { runAudit } from "@/lib/audit/run";
import { assertCanRunAudit } from "@/lib/audit/quota";
import { handleApiError, ApiError } from "@/lib/api-errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { periodDays?: number };
    const periodDays = typeof body.periodDays === "number" && body.periodDays > 0 && body.periodDays <= 90
      ? body.periodDays
      : 30;

    const original = await prisma.audit.findUnique({
      where: { id },
      include: { apiKey: true },
    });

    if (!original || original.companyId !== user.companyId) {
      throw new ApiError(404, "not_found", { detail: "Audit not found." });
    }

    if (!original.apiKeyId || !original.apiKey) {
      throw new ApiError(400, "no_key", {
        detail: "No API key is associated with this audit.",
      });
    }

    if (original.apiKey.deletedAt) {
      throw new ApiError(400, "key_revoked", {
        detail: "The API key for this audit has been revoked. Go to Profile > Providers to add a new key.",
      });
    }

    // One-free-audit moat: free-tier companies can't re-run (the existing
    // audit already consumed their single free run). Paid tiers are unlimited.
    await assertCanRunAudit(user.companyId);

    const newAudit = await prisma.audit.create({
      data: {
        companyId:   user.companyId,
        initiatedBy: user.id,
        apiKeyId:    original.apiKeyId,
        status:      "pending",
      },
    });

    try {
      await runAudit({ auditId: newAudit.id, deleteKeyOnDone: false, periodDays });
    } catch (err) {
      console.error("[rerun] audit run failed:", err);
    }

    return NextResponse.json({ auditId: newAudit.id });
  } catch (err) {
    return handleApiError(err);
  }
}

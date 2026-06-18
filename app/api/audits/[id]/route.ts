import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { Uuid } from "@/lib/validators";

/**
 * GET /api/audits/:id
 * Fetch audit results by ID. Requires authentication; an audit is only
 * readable by a member of the company that owns it. A mismatched or missing
 * audit returns the same 404 so we don't leak which audit ids exist.
 *
 * Response:
 * - id: audit ID
 * - status: "processing" | "completed" | "failed"
 * - createdAt, completedAt, startedAt
 * - findings: array of findings
 * - discoveredAgents: array of discovered agents ("agents" inferred from billing data)
 * - reportSummary: prose summary from LLM
 * - reportData: { byModel, dailySpendCents }
 * - totalMonthlySpendCents, estimatedWasteCents, efficiencyScore, totalApiCalls
 * - errorMessage: if status="failed"
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    Uuid.parse(id);

    // 1. Fetch audit (scoped to the caller's company) with findings and agents.
    const audit = await prisma.audit.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        findings: {
          orderBy: { orderHint: "asc" },
        },
        discoveredAgents: true,
      },
    });

    if (!audit) {
      throw new ApiError(404, "audit_not_found", { detail: "Audit not found." });
    }

    // 2. Return the audit record.
    return NextResponse.json({
      id: audit.id,
      status: audit.status,
      createdAt: audit.createdAt,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      findings: audit.findings,
      discoveredAgents: audit.discoveredAgents,
      reportSummary: audit.reportSummary,
      reportData: audit.reportData,
      totalMonthlySpendCents: audit.totalMonthlySpendCents?.toString(),
      estimatedWasteCents: audit.estimatedWasteCents?.toString(),
      efficiencyScore: audit.efficiencyScore,
      totalApiCalls: audit.totalApiCalls,
      totalTokensIn: audit.totalTokensIn?.toString(),
      totalTokensOut: audit.totalTokensOut?.toString(),
      errorMessage: audit.errorMessage,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

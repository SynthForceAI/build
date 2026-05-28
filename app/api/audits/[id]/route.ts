import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";

/**
 * GET /api/audits/:id
 * Fetch audit results by ID.
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Fetch audit with findings and agents.
    const audit = await prisma.audit.findUnique({
      where: { id },
      include: {
        findings: {
          orderBy: { orderHint: "asc" },
        },
        discoveredAgents: true,
      },
    });

    if (!audit) {
      return NextResponse.json(
        { error: "Audit not found" },
        { status: 404 },
      );
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

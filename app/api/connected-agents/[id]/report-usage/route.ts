/**
 * POST /api/connected-agents/:id/report-usage
 *
 * Called by an external agent (NOT a logged-in user) to report token usage.
 * `:id` is a ConnectedAgent id. Auth is the per-agent self-report token issued
 * at connect time, presented as `Authorization: Bearer <token>`. We store only
 * the token's hash, so we verify by hashing the presented value.
 *
 * Side effects: records a ConnectedAgentUsageLog, bumps the agent's rolling
 * spend/token counters and tasksMonitored, and flips pending -> active on the
 * first successful report.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, ApiError } from "@/lib/api-errors";
import { UsageReportSchema, Uuid } from "@/lib/validators";
import { verifyReportToken } from "@/lib/report-token";
import { calculateCostCents } from "@/lib/providers/pricing";
import { bigintToJson } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function bearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length).trim() || null;
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    Uuid.parse(id);

    const token = bearer(request);
    if (!token) {
      throw new ApiError(401, "missing_auth", { detail: "Provide the agent report token as a Bearer token." });
    }

    const agent = await prisma.connectedAgent.findFirst({
      where: { id, deletedAt: null },
    });

    // Same 403 whether the agent is missing or the token is wrong — don't leak
    // which agent ids exist to an unauthenticated caller.
    if (!agent || !verifyReportToken(token, agent.reportTokenHash)) {
      throw new ApiError(403, "invalid_agent_or_token");
    }

    const data = UsageReportSchema.parse(await request.json());

    const model = data.model ?? (agent.modelUsed || null);
    const costCents = data.cost ?? calculateCostCents(agent.providerName, model, data.tokensIn, data.tokensOut);
    const costCentsInt = BigInt(Math.round(costCents));

    const [log, updated] = await prisma.$transaction([
      prisma.connectedAgentUsageLog.create({
        data: {
          companyId:        agent.companyId,
          connectedAgentId: agent.id,
          providerId:       agent.providerId,
          source:           "self_report",
          tokensIn:         data.tokensIn,
          tokensOut:        data.tokensOut,
          costCents,
          model,
          durationMs:       data.durationMs ?? null,
          endpoint:         data.endpoint ?? null,
          statusCode:       data.statusCode ?? null,
          metadata:         (data.metadata ?? {}) as object,
        },
      }),
      prisma.connectedAgent.update({
        where: { id: agent.id },
        data: {
          status:              agent.status === "pending" ? "active" : agent.status,
          tasksMonitored:      { increment: 1 },
          totalTokensIn:       { increment: BigInt(data.tokensIn) },
          totalTokensOut:      { increment: BigInt(data.tokensOut) },
          totalCostCents:      { increment: costCentsInt },
          monthlySpendCents:   { increment: costCentsInt },
          lastUsageReportedAt: new Date(),
          lastActiveAt:        new Date(),
        },
      }),
    ]);

    return NextResponse.json(
      {
        success:        true,
        usageLogId:     log.id,
        status:         updated.status,
        tasksMonitored: updated.tasksMonitored,
        totalCostCents: bigintToJson(updated.totalCostCents),
        totalTokensIn:  bigintToJson(updated.totalTokensIn),
        totalTokensOut: bigintToJson(updated.totalTokensOut),
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

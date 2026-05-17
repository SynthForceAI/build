/**
 * Audit orchestrator. Loads the encrypted key, pulls usage, runs the
 * engine, writes findings, asks the LLM for a report, marks the audit
 * complete. On failure, marks status='failed' with an error message
 * the user can see.
 *
 * Runs inline inside the POST /api/audits handler for now. If audits
 * start exceeding the Vercel function timeout (10s Hobby, 60s Pro) we
 * move this into a Supabase Edge Function or a background queue.
 */
import { prisma } from "../db";
import { fetchOpenAIUsage, OpenAIPullerError } from "../providers/openai-billing";
import { analyze } from "./engine";
import { generateReport } from "./report";

export type RunAuditOptions = {
  auditId:       string;
  /** If true, soft-delete the API key row after the audit completes. */
  deleteKeyOnDone?: boolean;
  periodDays?:   number;
};

export async function runAudit({ auditId, deleteKeyOnDone, periodDays = 30 }: RunAuditOptions): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      company: { select: { name: true } },
      apiKey:  { include: { provider: true } },
    },
  });
  if (!audit) throw new Error(`audit ${auditId} not found`);
  if (!audit.apiKey) throw new Error(`audit ${auditId} has no api_key_id`);
  if (audit.apiKey.deletedAt) throw new Error(`audit ${auditId} references a deleted api key`);

  await prisma.audit.update({
    where: { id: auditId },
    data:  { status: "processing", startedAt: new Date() },
  });

  try {
    if (audit.apiKey.provider.name !== "openai") {
      // For now, only OpenAI is wired up. Anthropic/Google land later.
      throw new Error(`provider ${audit.apiKey.provider.name} not yet supported by the audit puller`);
    }

    // 1. Pull usage.
    const usage = await fetchOpenAIUsage({
      encryptedKey: audit.apiKey.encryptedKey,
      periodDays,
    });

    // 2. Persist raw logs first — if anything downstream fails we still
    //    have a reproducible trace.
    await prisma.auditRawLog.createMany({
      data: usage.rawResponses.map((r) => ({
        auditId,
        source: r.source,
        rawResponse: r.body as object,
      })),
    });

    // 3. Run deterministic analysis.
    const analysis = analyze(usage);

    // 4. Generate the prose report via LLM (or fallback).
    const reportSummary = await generateReport({
      companyName: audit.company.name,
      analysis,
    });

    // 5. Persist findings + discovered agents + summary in one transaction.
    await prisma.$transaction([
      prisma.auditFinding.createMany({
        data: analysis.findings.map((f) => ({
          auditId,
          type:     f.type,
          severity: f.severity,
          title:    f.title,
          description: f.description,
          potentialSavingsCents: f.potentialSavingsCents != null ? BigInt(f.potentialSavingsCents) : null,
          metadata: f.metadata as object,
          orderHint: f.orderHint,
        })),
      }),
      prisma.discoveredAgent.createMany({
        data: analysis.discoveredAgents.map((d) => ({
          auditId,
          name:             d.name,
          model:            d.model,
          providerName:     d.providerName,
          tasksCompleted:   d.tasksCompleted,
          totalCostCents:   BigInt(d.totalCostCents),
          totalTokensIn:    BigInt(d.totalTokensIn),
          totalTokensOut:   BigInt(d.totalTokensOut),
          efficiencyRating: d.efficiencyRating,
          details:          d.details as object,
        })),
      }),
      prisma.audit.update({
        where: { id: auditId },
        data: {
          status: "completed",
          completedAt: new Date(),
          dataPeriodStart:        usage.periodStart,
          dataPeriodEnd:          usage.periodEnd,
          totalMonthlySpendCents: BigInt(analysis.totalMonthlySpendCents),
          estimatedWasteCents:    BigInt(analysis.estimatedWasteCents),
          efficiencyScore:        analysis.efficiencyScore,
          totalApiCalls:          analysis.totalApiCalls,
          totalTokensIn:          BigInt(analysis.totalTokensIn),
          totalTokensOut:         BigInt(analysis.totalTokensOut),
          reportSummary,
          reportData: {
            byModel:        usage.byModel,
            dailySpendCents: usage.dailySpendCents,
          } as object,
        },
      }),
    ]);

    // 6. Privacy: optionally soft-delete the customer API key.
    if (deleteKeyOnDone) {
      await prisma.apiKey.update({
        where: { id: audit.apiKey.id },
        data: {
          deletedAt:    new Date(),
          isActive:     false,
          // Zero out the cipher payload — key material no longer recoverable.
          encryptedKey: "",
        },
      });
    }
  } catch (err) {
    const message = err instanceof OpenAIPullerError ? err.message : (err instanceof Error ? err.message : "unknown error");
    await prisma.audit.update({
      where: { id: auditId },
      data:  { status: "failed", completedAt: new Date(), errorMessage: message },
    });
    throw err;
  }
}

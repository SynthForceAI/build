import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AuditCreateSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity-logs";
import { encryptApiKey } from "@/lib/crypto";
import { runAudit } from "@/lib/audit/run";
import { handleApiError } from "@/lib/api-errors";

/**
 * POST /api/audits
 * Create a new audit. Accepts raw API key, encrypts it, creates audit record,
 * and kicks off the audit run synchronously (or queues it for later).
 *
 * Request body:
 * - apiKey: string (raw API key to audit)
 * - periodDays?: number (default 30, max 90)
 *
 * Response:
 * - id: audit ID
 * - status: "processing" | "completed" | "failed"
 * - createdAt: timestamp
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AuditCreateSchema.parse(body);

    // 1. Create OpenAI provider record if it doesn't exist (for free audit).
    let provider = await prisma.provider.findUnique({
      where: { name: "openai" },
    });
    if (!provider) {
      provider = await prisma.provider.create({
        data: {
          name: "openai",
          displayName: "OpenAI",
          slug: "openai",
          description: "OpenAI API access",
        },
      });
    }

    // 2. Get or create the free-audit system company and user.
    let freeAuditCompany = await prisma.company.findUnique({
      where: { slug: "free-audit-system" },
    });
    if (!freeAuditCompany) {
      freeAuditCompany = await prisma.company.create({
        data: {
          name: "Free Audit System",
          slug: "free-audit-system",
          subscriptionTier: "free",
        },
      });
    }

    let freeAuditUser = await prisma.user.findFirst({
      where: { email: "system@synthforce.local" },
    });
    if (!freeAuditUser) {
      // id must match a Supabase auth.users UUID; use a stable sentinel for the system user
      freeAuditUser = await prisma.user.create({
        data: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "system@synthforce.local",
          name: "System",
          companyId: freeAuditCompany.id,
        },
      });
    }

    // 3. Encrypt and store the API key.
    const encryptedKey = encryptApiKey(parsed.apiKey);
    const apiKey = await prisma.apiKey.create({
      data: {
        companyId: freeAuditCompany.id,
        providerId: provider.id,
        label: "Free Audit Key",
        encryptedKey,
        isActive: true,
      },
    });

    // 4. Create audit record linked to the free-audit system.
    const audit = await prisma.audit.create({
      data: {
        companyId: freeAuditCompany.id,
        initiatedBy: freeAuditUser.id,
        apiKeyId: apiKey.id,
        status: "processing",
      },
    });

    // 5. Run the audit (inline for now; move to background queue if it gets slow).
    //    Set deleteKeyOnDone=true so we don't keep customer API keys around.
    try {
      await runAudit({
        auditId: audit.id,
        deleteKeyOnDone: true,
        periodDays: parsed.periodDays ?? 30,
      });
    } catch (err) {
      // runAudit() already marks the audit as failed in the DB.
      // We still return the audit ID so the user can poll for results.
      console.error("Audit run failed:", err);
    }

    // 6. Return audit record with embedded findings for fast initial render.
    const auditWithFindings = await prisma.audit.findUnique({
      where: { id: audit.id },
      include: {
        findings: true,
        discoveredAgents: true,
      },
    });

    return NextResponse.json({
      id: auditWithFindings?.id,
      status: auditWithFindings?.status,
      createdAt: auditWithFindings?.createdAt,
      findings: auditWithFindings?.findings ?? [],
      discoveredAgents: auditWithFindings?.discoveredAgents ?? [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}

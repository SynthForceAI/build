import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProviderConnectSchema } from "@/lib/validators";
import { encryptApiKey, keyIdentifierFrom } from "@/lib/crypto";
import { verifyProviderKey } from "@/lib/providers";
import { generateReportToken, hashReportToken } from "@/lib/report-token";
import { requireUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await req.json();
    const parsed = ProviderConnectSchema.parse(body);

    const provider = await prisma.provider.findFirst({
      where: { id: parsed.providerId, isActive: true },
    });
    if (!provider) {
      throw new ApiError(400, "provider_not_found", { detail: "Invalid provider ID." });
    }

    // Verify the key works — make a real test call to the provider
    let availableModels: string[];
    try {
      availableModels = await verifyProviderKey(provider.name, parsed.apiKey, parsed.keyType);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid API key or rate limited";
      throw new ApiError(400, "key_verification_failed", { detail: msg });
    }

    const encrypted = encryptApiKey(parsed.apiKey);
    const fingerprint = keyIdentifierFrom(parsed.apiKey);

    // Reject duplicates: same fingerprint + provider for this company (non-deleted)
    const existing = await prisma.apiKey.findFirst({
      where: {
        companyId:    user.companyId,
        providerId:   provider.id,
        keyIdentifier: fingerprint,
        deletedAt:    null,
      },
    });
    if (existing) {
      throw new ApiError(409, "key_already_connected", {
        detail: "This API key is already connected to your account.",
      });
    }

    // Free any soft-deleted keys that share the same label+provider+company —
    // they still hold their unique index slot and would cause a P2002 on insert.
    const label = parsed.label ?? parsed.agentName;
    const stale = await prisma.apiKey.findMany({
      where: { companyId: user.companyId, providerId: provider.id, label, deletedAt: { not: null } },
      select: { id: true },
    });
    for (const k of stale) {
      await prisma.apiKey.update({ where: { id: k.id }, data: { label: `${label}__deleted_${k.id}` } });
    }

    const now = new Date();
    const apiKey = await prisma.apiKey.create({
      data: {
        companyId:       user.companyId,
        providerId:      provider.id,
        label,
        encryptedKey:    encrypted,
        keyIdentifier:   fingerprint,
        isActive:        true,
        verifiedAt:      now,
        availableModels: availableModels,
      },
    });

    // Admin keys (sk-admin-…) double as org-level usage polling keys.
    // Upsert a ProviderAdminKey so the sync job finds this key automatically
    // without requiring a separate setup step in Settings.
    if (parsed.keyType === "admin") {
      await prisma.providerAdminKey.upsert({
        where:  { companyId_providerId: { companyId: user.companyId, providerId: provider.id } },
        create: {
          companyId:    user.companyId,
          providerId:   provider.id,
          encryptedKey: encrypted,
          metadata:     { keyType: "admin", sourceApiKeyId: apiKey.id },
          lastSyncedAt: null, // Force 30-day backfill on first sync
        },
        update: {
          encryptedKey: encrypted,
          metadata:     { keyType: "admin", sourceApiKeyId: apiKey.id },
        },
      });
    }

    // One-time self-report token for this agent. We store only its hash; the
    // raw value is returned below exactly once so the agent can be configured
    // to POST usage to /api/connected-agents/{id}/report-usage.
    const reportToken = generateReportToken();

    const connectedAgent = await prisma.connectedAgent.create({
      data: {
        companyId:       user.companyId,
        apiKeyId:        apiKey.id,
        providerId:      provider.id,
        departmentId:    parsed.departmentId ?? null,
        name:            parsed.agentName,
        providerName:    provider.name,
        modelUsed:       availableModels[0] ?? "",
        status:          "active",
        reportTokenHash: hashReportToken(reportToken),
      },
    });

    // Create the Agent record so the agent appears in the dashboard, performance,
    // and agents pages — which all read from the Agent table, not ConnectedAgent.
    await prisma.agent.create({
      data: {
        companyId:    user.companyId,
        name:         parsed.agentName,
        departmentId: parsed.departmentId ?? null,
        providerId:   provider.id,
        apiKeyId:     apiKey.id,
        status:       "active",
      },
    });

    return NextResponse.json(
      {
        agentId:         connectedAgent.id,
        name:            connectedAgent.name,
        providerName:    connectedAgent.providerName,
        status:          connectedAgent.status,
        availableModels,
        connectedAt:     connectedAgent.connectedAt,
        // Shown once. Persist client-side; it cannot be retrieved again.
        reportToken,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * GET /api/providers/connected
 *
 * One row per active Provider showing whether the caller's company has any
 * active ApiKey for it. ApiKeys are company-scoped (see schema.prisma), so
 * the result is shared across all users in the same workspace.
 *
 * We approximate "last used" via the most recent verifiedAt across the
 * provider's keys. UsageLog.lastActiveAt would be more accurate but is
 * agent-scoped, not key-scoped — and would require an aggregate per call.
 * Verification timestamp is a good enough proxy for the profile page.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireUser();

    const providers = await prisma.provider.findMany({
      where:   { isActive: true },
      orderBy: { displayName: "asc" },
      select:  { id: true, name: true, displayName: true },
    });

    const keys = await prisma.apiKey.findMany({
      where: {
        companyId: user.companyId,
        isActive:  true,
        deletedAt: null,
      },
      select: { providerId: true, verifiedAt: true, createdAt: true },
    });

    const byProvider = new Map<string, { keysCount: number; lastUsedAt: Date | null }>();
    for (const k of keys) {
      const cur = byProvider.get(k.providerId) ?? { keysCount: 0, lastUsedAt: null };
      cur.keysCount += 1;
      const ts = k.verifiedAt ?? k.createdAt;
      if (!cur.lastUsedAt || ts > cur.lastUsedAt) cur.lastUsedAt = ts;
      byProvider.set(k.providerId, cur);
    }

    return NextResponse.json({
      providers: providers.map((p) => {
        const stats = byProvider.get(p.id);
        return {
          id:          p.id,
          name:        p.name,
          displayName: p.displayName,
          connected:   !!stats && stats.keysCount > 0,
          keysCount:   stats?.keysCount ?? 0,
          lastUsedAt:  stats?.lastUsedAt ?? null,
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

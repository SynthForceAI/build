/**
 * Profile page - account, workspace, connected providers, preferences,
 * and password change. Loads all data server-side, hands off to the
 * client component for interactivity.
 */

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { ProfileClient, type ProfileData } from "./components/ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  let userId: string;
  let companyId: string;
  try {
    const { user } = await requireUser();
    userId = user.id;
    companyId = user.companyId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const [user, prefs, providers, apiKeys] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where:   { id: userId },
      include: { company: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.userPreferences.findUnique({ where: { userId } }),
    prisma.provider.findMany({
      where:   { isActive: true },
      orderBy: { displayName: "asc" },
      select:  { id: true, name: true, displayName: true },
    }),
    prisma.apiKey.findMany({
      // Scope to the caller's company at the DB layer — never load other
      // tenants' keys into memory and rely on a post-filter.
      where:   { companyId, isActive: true, deletedAt: null },
      select: {
        id:            true,
        providerId:    true,
        label:         true,
        keyIdentifier: true,
        verifiedAt:    true,
        createdAt:     true,
      },
    }),
  ]);

  type ProviderStats = {
    count:      number;
    lastUsedAt: Date | null;
    keys:       Array<{ id: string; keyIdentifier: string | null; label: string | null; createdAt: string }>;
  };

  const byProvider = new Map<string, ProviderStats>();
  for (const k of apiKeys) {
    const cur = byProvider.get(k.providerId) ?? { count: 0, lastUsedAt: null, keys: [] };
    cur.count += 1;
    const ts = k.verifiedAt ?? k.createdAt;
    if (!cur.lastUsedAt || ts > cur.lastUsedAt) cur.lastUsedAt = ts;
    cur.keys.push({
      id:            k.id,
      keyIdentifier: k.keyIdentifier,
      label:         k.label,
      createdAt:     k.createdAt.toISOString(),
    });
    byProvider.set(k.providerId, cur);
  }

  const data: ProfileData = {
    user: {
      id:        user.id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
      createdAt: user.createdAt.toISOString(),
    },
    company: {
      id:   user.company.id,
      name: user.company.name,
      slug: user.company.slug,
    },
    preferences: {
      emailDigest: prefs?.emailDigest ?? "never",
      currency:    prefs?.currency ?? "USD",
    },
    providers: providers.map((p) => {
      const stats = byProvider.get(p.id);
      return {
        id:          p.id,
        name:        p.name,
        displayName: p.displayName,
        connected:   !!stats && stats.count > 0,
        keysCount:   stats?.count ?? 0,
        lastUsedAt:  stats?.lastUsedAt?.toISOString() ?? null,
        keys:        stats?.keys ?? [],
      };
    }),
  };

  return <ProfileClient data={data} />;
}

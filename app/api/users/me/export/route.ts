import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { user } = await requireUser();

        const [profile, prefs, apiKeys, audits] = await Promise.all([
            prisma.user.findUniqueOrThrow({
                where: { id: user.id },
                include: { company: { select: { id: true, name: true, slug: true } } },
            }),
            prisma.userPreferences.findUnique({ where: { userId: user.id } }),
            prisma.apiKey.findMany({
                where: { isActive: true, deletedAt: null },
                select: {
                    id: true, label: true, keyIdentifier: true, createdAt: true,
                    provider: { select: { displayName: true } }
                },
            }),
            prisma.audit.findMany({
                where: { initiatedBy: user.id },
                orderBy: { createdAt: "desc" },
                take: 100,
                select: {
                    id: true, status: true, createdAt: true,
                    apiKey: { select: { provider: { select: { displayName: true } } } },
                },
            }),
        ]);

        const payload = {
            exportedAt: new Date().toISOString(),
            user: {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                role: profile.role,
                createdAt: profile.createdAt,
                company: profile.company,
            },
            preferences: prefs ?? null,
            apiKeys: apiKeys.map((k) => ({
                id: k.id,
                label: k.label,
                provider: k.provider.displayName,
                keyFragment: k.keyIdentifier ? `…${k.keyIdentifier}` : null,
                connectedAt: k.createdAt,
            })),
            auditHistory: audits.map((a) => ({
                id: a.id,
                provider: a.apiKey?.provider.displayName ?? null,
                status: a.status,
                createdAt: a.createdAt,
            })),
        };

        return new NextResponse(JSON.stringify(payload, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="synthforce-export-${user.id}.json"`,
            },
        });
    } catch (err) {
        return handleApiError(err);
    }
}

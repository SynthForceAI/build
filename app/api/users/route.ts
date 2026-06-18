/**
 * GET /api/users — platform-owner-only listing of every user across all
 * companies. Authenticated via a real Supabase session; the caller must be
 * the platform owner (OWNER_EMAIL). See lib/auth.ts `requireOwner`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireOwner();

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (err) {
    return handleApiError(err);
  }
}

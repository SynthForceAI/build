/**
 * GET   /api/users/me/preferences  - email digest + currency
 * PATCH /api/users/me/preferences  - upsert preferences
 *
 * Preferences live in their own table (user_preferences) so we can extend
 * them later without colliding with Supabase auth metadata.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { PreferencesUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const DEFAULTS = { emailDigest: "never" as const, currency: "USD" };

async function loadPrefs(userId: string) {
  const row = await prisma.userPreferences.findUnique({ where: { userId } });
  if (!row) return DEFAULTS;
  return { emailDigest: row.emailDigest, currency: row.currency };
}

export async function GET() {
  try {
    const { user } = await requireUser();
    return NextResponse.json({ preferences: await loadPrefs(user.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser();
    const body = await request.json();
    const parsed = PreferencesUpdateSchema.parse(body);

    await prisma.userPreferences.upsert({
      where:  { userId: user.id },
      create: { userId: user.id, ...parsed },
      update: parsed,
    });

    return NextResponse.json({ preferences: await loadPrefs(user.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

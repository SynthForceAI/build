/**
 * GET   /api/users/me  - current user's profile (name, email, role, company)
 * PATCH /api/users/me  - update display name (Prisma + Supabase user_metadata)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

async function loadProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      company: { select: { id: true, name: true, slug: true } },
    },
  });
  return {
    id:        user.id,
    name:      user.name,
    email:     user.email,
    role:      user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    company: {
      id:   user.company.id,
      name: user.company.name,
      slug: user.company.slug,
    },
  };
}

export async function GET() {
  try {
    const { user } = await requireUser();
    return NextResponse.json({ profile: await loadProfile(user.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser();
    const body = await request.json();
    const parsed = ProfileUpdateSchema.parse(body);

    if (parsed.name) {
      await prisma.user.update({
        where: { id: user.id },
        data:  { name: parsed.name },
      });
      // Mirror to Supabase user_metadata so the auth session reflects it
      // immediately without forcing a re-login.
      const supabase = await createSupabaseServerClient();
      await supabase.auth.updateUser({ data: { display_name: parsed.name } });
    }

    return NextResponse.json({ profile: await loadProfile(user.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

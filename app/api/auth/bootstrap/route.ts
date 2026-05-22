/**
 * POST /api/auth/bootstrap
 *
 * Called once, immediately after a Supabase signup, to create the
 * SynthForce-side `companies` + `users` rows. Idempotent: re-running
 * with the same auth user returns the existing rows.
 *
 * Body: { companyName: string, slug?: string, name?: string }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/api-errors";

const BootstrapSchema = z.object({
  companyName: z.string().trim().min(1).max(255),
  slug:        z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  name:        z.string().trim().min(1).max(255).optional(),
}).strict();

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100) || "company";
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error || !authUser) throw new ApiError(401, "unauthenticated");

    const body = BootstrapSchema.parse(await request.json());

    const existingUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { company: true },
    });
    if (existingUser) {
      return NextResponse.json({ user: existingUser, company: existingUser.company });
    }

    // Generate a unique slug — append a short random suffix if it collides.
    let slug = body.slug ?? slugify(body.companyName);
    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = await prisma.company.findUnique({ where: { slug } });
      if (!taken) break;
      slug = `${slugify(body.companyName)}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: body.companyName, slug },
      });
      const user = await tx.user.create({
        data: {
          id:        authUser.id,
          companyId: company.id,
          email:     authUser.email ?? "",
          name:      body.name ?? authUser.user_metadata?.name ?? authUser.email ?? "User",
          role:      "owner",
          lastLoginAt: new Date(),
        },
      });
      return { company, user };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

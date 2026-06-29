import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity-logs";
import { isOwner } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        const existing = await prisma.user.findUnique({ where: { id: authUser.id } });

        if (!existing) {
          const email = authUser.email ?? "";
          const name =
            authUser.user_metadata?.full_name ??
            authUser.user_metadata?.name ??
            email.split("@")[0];

          const company = await prisma.company.create({
            data: {
              name: `${name}'s Workspace`,
              slug: `workspace-${authUser.id.substring(0, 8)}`,
            },
          });

          const user = await prisma.user.create({
            data: {
              id: authUser.id,
              email,
              name,
              companyId: company.id,
              role: "owner",
            },
          });

          await logActivity(user.id, "signup", { method: "google_oauth" });
        } else {
          await prisma.user.update({
            where: { id: authUser.id },
            data: { lastLoginAt: new Date() },
          });
          await logActivity(existing.id, "login", { method: "google_oauth" });
        }

        const destination = isOwner(authUser.email) ? "/owner/users" : "/U";
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

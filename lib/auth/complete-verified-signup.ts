import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity-logs";
import { provisionNewUser } from "@/lib/auth/provision-user";

/**
 * After Supabase confirms an email, ensure the SynthForce-side account exists.
 * Returns whether this call created the user row (first-time signup completion).
 */
export async function completeVerifiedSignup(authUser: SupabaseUser): Promise<{
  user: Awaited<ReturnType<typeof provisionNewUser>>;
  created: boolean;
}> {
  const email = authUser.email;
  if (!email) {
    throw new Error("Verified Supabase user is missing an email address.");
  }

  const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
  const user = await provisionNewUser({ id: authUser.id, email });

  if (!existing) {
    await logActivity(user.id, "signup", { method: "email_password" });
    return { user, created: true };
  }

  return { user, created: false };
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity-logs";
import { isOwner } from "@/lib/auth";
import { rateLimitByIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Brute-force protection: cap login attempts per IP.
  const rl = rateLimitByIp(req, { scope: "auth-login", limit: 10, windowMs: 5 * 60_000 });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Authentication is delegated entirely to Supabase. The platform owner is
    // simply the user whose email matches OWNER_EMAIL — there is no separate
    // password-in-env backdoor and no self-asserted "owner" token.
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const userId = data.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please sign up first." },
        { status: 404 },
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    await logActivity(userId, "login", { method: "email_password" });

    // Supabase's @supabase/ssr writes the httpOnly session cookies for us via
    // createSupabaseServerClient. We intentionally do NOT return the access
    // token in the body or mirror it into a second cookie.
    return NextResponse.json({
      id:      user.id,
      email:   user.email,
      isOwner: isOwner(user.email),
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "An error occurred during login" }, { status: 500 });
  }
}

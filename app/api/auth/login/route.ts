import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity-logs";
import { isOwner } from "@/lib/auth";
import { isEmailConfirmed } from "@/lib/auth/email-verification";
import { rateLimitByIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, { scope: "auth-login", limit: 10, windowMs: 5 * 60_000 });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!isEmailConfirmed(data.user)) {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          error: "Please verify your email before signing in.",
          code: "email_not_verified",
        },
        { status: 403 },
      );
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

    return NextResponse.json({
      id: user.id,
      email: user.email,
      isOwner: isOwner(user.email),
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "An error occurred during login" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailVerificationRedirectUrl } from "@/lib/auth/email-verification";
import { provisionNewUser } from "@/lib/auth/provision-user";
import { logActivity } from "@/lib/activity-logs";
import { rateLimitByIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, { scope: "auth-signup", limit: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailVerificationRedirectUrl(),
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Signup failed" }, { status: 500 });
    }

    // When Supabase "Confirm email" is enabled, signUp returns a user but no session.
    // Defer SynthForce account provisioning until the user clicks the verification link.
    if (!data.session) {
      return NextResponse.json({
        needsEmailVerification: true,
        email: data.user.email ?? email,
      });
    }

    const user = await provisionNewUser({
      id: data.user.id,
      email: data.user.email ?? email,
    });

    await logActivity(user.id, "signup", {
      method: "email_password",
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "An error occurred during signup" }, { status: 500 });
  }
}

import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { completeVerifiedSignup } from "@/lib/auth/complete-verified-signup";
import { redirectAfterAuth } from "@/lib/auth/redirect-after-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles Supabase email-confirmation redirects (PKCE `code` or OTP `token_hash`).
 * Provisions the SynthForce account only after the email is verified.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/verify-email?error=confirmation_failed", request.url));
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return NextResponse.redirect(new URL("/verify-email?error=confirmation_failed", request.url));
    }
  } else {
    return NextResponse.redirect(new URL("/verify-email?error=missing_token", request.url));
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email_confirmed_at || !user.email) {
    return NextResponse.redirect(new URL("/verify-email?error=confirmation_failed", request.url));
  }

  await completeVerifiedSignup(user);
  return redirectAfterAuth(request, next);
}

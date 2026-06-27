import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailVerificationRedirectUrl } from "@/lib/auth/email-verification";
import { rateLimitByIp, tooManyRequests } from "@/lib/rate-limit";

const ResendSchema = z.object({
  email: z.string().trim().email(),
}).strict();

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, { scope: "auth-resend-verification", limit: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  try {
    const parsed = ResendSchema.parse(await req.json());
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.email,
      options: {
        emailRedirectTo: emailVerificationRedirectUrl(),
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Do not reveal whether the address is registered.
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "An error occurred while sending the verification email." }, { status: 500 });
  }
}

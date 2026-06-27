import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { WaitlistSignupSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-errors";
import { rateLimitByIp, tooManyRequests } from "@/lib/rate-limit";

/**
 * POST /api/waitlist
 * Public marketing waitlist signup. Stores leads in Postgres — no third-party
 * form limits. Rate-limited per IP to reduce spam.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, { scope: "waitlist-signup", limit: 10, windowMs: 10 * 60_000 });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  try {
    const body = await req.json();
    const parsed = WaitlistSignupSchema.parse(body);
    const email = parsed.email.toLowerCase();

    await prisma.waitlistSignup.upsert({
      where: { email },
      create: {
        email,
        name:    parsed.name,
        company: parsed.company,
        role:    parsed.role,
        source:  parsed.source,
      },
      update: {
        ...(parsed.name    ? { name: parsed.name }       : {}),
        ...(parsed.company ? { company: parsed.company } : {}),
        ...(parsed.role    ? { role: parsed.role }       : {}),
        ...(parsed.source  ? { source: parsed.source }   : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * GET /api/jobs/sync-provider-usage
 *
 * Invoked by Vercel Cron (see vercel.json crons). Vercel injects
 * `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set;
 * we fail closed if it isn't. Also callable manually with the same header.
 */
import { NextResponse } from "next/server";
import { syncAllProviderUsage } from "@/lib/jobs/sync-provider-usage";

export const dynamic = "force-dynamic";
// Provider polling can fan out across several admin keys; give it headroom.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  }

  try {
    const summary = await syncAllProviderUsage();
    return NextResponse.json(summary);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[sync-provider-usage] job crashed:", error);
    return NextResponse.json({ error: { code: "job_failed" } }, { status: 500 });
  }
}

/**
 * POST /api/jobs/sync-provider-usage
 *
 * Invoked by the GitHub Actions workflow at
 * .github/workflows/sync-provider-usage.yml. Caller must send
 * `Authorization: Bearer <SYNC_JOB_SECRET>`; we fail closed if the env var is
 * absent or the header doesn't match.
 */
import { NextResponse } from "next/server";
import { syncAllProviderUsage } from "@/lib/jobs/sync-provider-usage";

export const dynamic = "force-dynamic";
// Provider polling can fan out across several admin keys; give it headroom.
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.SYNC_JOB_SECRET;
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

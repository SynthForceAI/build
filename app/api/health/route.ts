/**
 * Health check. Confirms the function can boot and reach the database.
 * Returns 200 with { status: 'ok', db: 'reachable' } on success.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status:    "ok",
      db:        "reachable",
      latencyMs: Date.now() - started,
      ts:        new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        db:     "unreachable",
        error:  err instanceof Error ? err.message : "unknown",
      },
      { status: 503 },
    );
  }
}

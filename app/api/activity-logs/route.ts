/**
 * GET  /api/activity-logs — platform-owner-only cross-tenant activity feed.
 * POST /api/activity-logs — record an activity entry for the *authenticated*
 *                           user. The actor is derived from the session, never
 *                           from the request body, so callers cannot forge
 *                           entries against other users.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireOwner } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const PaginationSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const ActivityCreateSchema = z.object({
  action:   z.enum(["signup", "login", "logout"]),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    await requireOwner();

    const { searchParams } = new URL(req.url);
    const { limit, offset } = PaginationSchema.parse({
      limit:  searchParams.get("limit")  ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count(),
    ]);

    const formattedLogs = logs.map((log) => ({
      id:        log.id,
      userId:    log.userId,
      userEmail: log.user.email,
      action:    log.action,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({ logs: formattedLogs, total });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const { action, metadata } = ActivityCreateSchema.parse(await req.json());

    const log = await prisma.activityLog.create({
      data: {
        userId:   user.id, // actor from the session, not the request body
        action,
        metadata: (metadata ?? {}) as object,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

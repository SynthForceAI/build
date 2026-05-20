import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("synthforce_auth")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if it's owner token
    if (!token.startsWith("owner_")) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const logs = await prisma.activityLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.activityLog.count();

    // Format response
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userEmail: log.user.email,
      action: log.action,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({ logs: formattedLogs, total });
  } catch (error) {
    console.error("Get activity logs error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, action, metadata } = await req.json();

    if (!userId || !action) {
      return NextResponse.json(
        { error: "userId and action required" },
        { status: 400 }
      );
    }

    const log = await prisma.activityLog.create({
      data: {
        userId,
        action,
        metadata: metadata || {},
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Create activity log error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

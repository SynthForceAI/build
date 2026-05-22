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

    // Check if it's owner token (simple check for demo)
    if (!token.startsWith("owner_")) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }

    // Get all users (excluding the owner user itself)
    const users = await prisma.user.findMany({
      where: {
        id: { not: "owner-synthforce" }, // Exclude owner from list
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

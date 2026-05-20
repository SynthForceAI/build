import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity-logs";
import { cookies } from "next/headers";
import { OWNER_EMAIL } from "@/lib/auth";

const OWNER_PASSWORD = "samarth1234";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Check if this is owner login
    const isOwnerLogin = email === OWNER_EMAIL && password === OWNER_PASSWORD;

    let userId: string;
    let isOwner = false;

    if (isOwnerLogin) {
      // Special owner case
      let ownerUser = await prisma.user.findUnique({
        where: { id: "owner-synthforce" },
      });

      if (!ownerUser) {
        // Create default owner company
        let ownerCompany = await prisma.company.findFirst({
          where: { name: "SynthForce Admin" },
        });

        if (!ownerCompany) {
          ownerCompany = await prisma.company.create({
            data: {
              name: "SynthForce Admin",
              slug: "synthforce-admin",
            },
          });
        }

        ownerUser = await prisma.user.create({
          data: {
            id: "owner-synthforce",
            email: OWNER_EMAIL,
            name: "Owner",
            companyId: ownerCompany.id,
            role: "owner",
          },
        });
      }

      userId = ownerUser.id;
      isOwner = true;

      // Log activity
      await logActivity(userId, "login", { method: "owner" });

      // Set auth cookie
      const cookieStore = await cookies();
      const ownerToken = `owner_${userId}_${Date.now()}`;
      cookieStore.set("synthforce_auth", ownerToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });

      return NextResponse.json({
        id: userId,
        email: OWNER_EMAIL,
        isOwner: true,
        token: ownerToken,
      });
    }

    // Regular user login via Supabase
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    userId = data.user.id;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please sign up first." },
        { status: 404 }
      );
    }

    // Update last login
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    // Log activity
    await logActivity(userId, "login", { method: "email_password" });

    // Set auth cookie
    if (data.session?.access_token) {
      const cookieStore = await cookies();
      cookieStore.set("synthforce_auth", data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      isOwner: false,
      token: data.session?.access_token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "An error occurred during login" }, { status: 500 });
  }
}

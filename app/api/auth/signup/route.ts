import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity-logs";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Create user in Supabase Auth
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Signup failed" }, { status: 500 });
    }

    // Create default company for user (if they don't have one)
    let company = await prisma.company.findFirst({
      where: {
        users: {
          some: { id: data.user.id },
        },
      },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: `${email}'s Workspace`,
          slug: `workspace-${data.user.id.substring(0, 8)}`,
        },
      });
    }

    // Create user in SynthForce users table
    const user = await prisma.user.upsert({
      where: { id: data.user.id },
      create: {
        id: data.user.id,
        email,
        name: email.split("@")[0],
        companyId: company.id,
      },
      update: {
        email,
      },
    });

    // Log signup activity
    await logActivity(user.id, "signup", {
      method: "email_password",
    });

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
      token: data.session?.access_token,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "An error occurred during signup" }, { status: 500 });
  }
}

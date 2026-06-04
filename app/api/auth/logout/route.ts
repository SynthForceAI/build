import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    // Sign out of Supabase — clears the Supabase session cookies so that
    // requireUser() returns a clean 401 on the next request. Without this,
    // Supabase still considers the user authenticated even after we delete
    // the synthforce_auth cookie, causing a redirect loop on /login.
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    const cookieStore = await cookies();
    cookieStore.delete("synthforce_auth");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "An error occurred during logout" }, { status: 500 });
  }
}

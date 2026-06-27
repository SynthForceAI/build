import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
  try {
    // Sign out of Supabase - clears the Supabase session cookies so that
    // requireUser() returns a clean 401 on the next request.
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });
    // Clear the "intro played this login" cookie so the intro plays again
    // after the next login. The permanent skip cookie is left intact.
    response.cookies.set("synthforce-intro-played", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "An error occurred during logout" }, { status: 500 });
  }
}

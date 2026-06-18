import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
  try {
    // Sign out of Supabase - clears the Supabase session cookies so that
    // requireUser() returns a clean 401 on the next request.
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "An error occurred during logout" }, { status: 500 });
  }
}

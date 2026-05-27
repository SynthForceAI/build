/**
 * Refreshes the Supabase auth session on every request that passes through
 * Next.js proxy. Without this, cookies expire and protected routes
 * start 401-ing intermittently.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookiesToSet = { name: string; value: string; options?: CookieOptions }[];

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: do not put any logic between createServerClient and getUser —
  // the @supabase/ssr docs are explicit about this. getUser() is what
  // forces a refresh when the access token is near expiry.
  await supabase.auth.getUser();
  return response;
}

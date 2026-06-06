import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookiesToSet = { name: string; value: string; options?: CookieOptions }[];

// Routes that authenticated users should not linger on
const AUTH_BYPASS = ["/", "/login", "/signup"];
// Routes that require authentication (prefix match)
const PROTECTED_PREFIX = "/U";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Always refresh the session so cookies stay valid
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect authenticated users away from public-only pages
  if (user && AUTH_BYPASS.includes(pathname)) {
    return NextResponse.redirect(new URL("/U", request.url));
  }

  // Redirect unauthenticated users away from protected pages
  if (!user && pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|assets|api).*)",
  ],
};

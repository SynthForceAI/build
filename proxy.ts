import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookiesToSet = { name: string; value: string; options?: CookieOptions }[];

// Routes that authenticated users should not linger on (auth pages only — not marketing pages)
const AUTH_BYPASS = ["/login", "/signup"];
// Route prefixes that require authentication. The owner area additionally
// enforces an owner-email check in the page itself; this is the coarse gate.
const PROTECTED_PREFIXES = ["/U", "/owner"];

export async function proxy(request: NextRequest) {
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
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh session on every request (keeps cookies valid)
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect authenticated users away from public-only pages
  if (user && AUTH_BYPASS.includes(pathname)) {
    return NextResponse.redirect(new URL("/U", request.url));
  }

  // Redirect unauthenticated users away from protected pages
  if (!user && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

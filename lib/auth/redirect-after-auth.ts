import { NextResponse, type NextRequest } from "next/server";

function sanitizeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/U";
  }
  return next;
}

export function redirectAfterAuth(request: NextRequest, next: string | null): NextResponse {
  const destination = sanitizeNextPath(next);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const { origin } = request.nextUrl;

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${destination}`);
  }
  if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${destination}`);
  }
  return NextResponse.redirect(`${origin}${destination}`);
}

import { type NextRequest, NextResponse } from "next/server";
import { routeProxyRequest } from "@/lib/proxy/router";
import { handleApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// Response headers to forward back to the caller
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "x-request-id",
  "anthropic-ratelimit-requests-limit",
  "anthropic-ratelimit-requests-remaining",
  "anthropic-ratelimit-tokens-limit",
  "anthropic-ratelimit-tokens-remaining",
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
];

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; path: string[] }> },
) {
  try {
    const { provider, path: pathSegments } = await params;
    const path = "/" + (pathSegments?.join("/") ?? "");

    const { response, agentContext: _ } = await routeProxyRequest(
      provider,
      path,
      req.method,
      req.headers,
      req.body,
    );

    // Pipe response headers back (rate limit info etc.)
    const responseHeaders = new Headers();
    for (const header of FORWARDED_RESPONSE_HEADERS) {
      const value = response.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    // Stream the body through unmodified - handles both JSON and SSE streaming
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET    = handle;
export const POST   = handle;
export const PUT    = handle;
export const PATCH  = handle;
export const DELETE = handle;

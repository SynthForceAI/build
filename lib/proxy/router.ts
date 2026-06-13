import { ApiError } from "@/lib/api-errors";
import { identifyAgent, type AgentContext } from "@/lib/proxy/middleware/identify-agent";

// Providers that use x-api-key instead of Authorization: Bearer
const API_KEY_PROVIDERS = new Set(["anthropic"]);

// Headers we forward from the incoming request (allowlist to avoid leaking
// internal headers like Host, Cookie, or our own Authorization).
const FORWARDED_HEADERS = new Set([
  "content-type",
  "accept",
  "anthropic-version",
  "anthropic-beta",
  "openai-beta",
  "x-request-id",
]);

function buildProviderHeaders(
  providerName: string,
  providerApiKey: string,
  incomingHeaders: Headers,
): Headers {
  const out = new Headers();

  for (const [key, value] of incomingHeaders.entries()) {
    if (FORWARDED_HEADERS.has(key.toLowerCase())) {
      out.set(key, value);
    }
  }

  if (API_KEY_PROVIDERS.has(providerName)) {
    out.set("x-api-key", providerApiKey);
    // Ensure anthropic-version is always set even if the caller omitted it
    if (!out.has("anthropic-version")) {
      out.set("anthropic-version", "2023-06-01");
    }
  } else {
    out.set("Authorization", `Bearer ${providerApiKey}`);
  }

  return out;
}

export type ProxyResult = {
  response: Response;
  agentContext: AgentContext;
};

export async function routeProxyRequest(
  provider: string,
  path: string,
  method: string,
  incomingHeaders: Headers,
  body: ReadableStream | null,
): Promise<ProxyResult> {
  // Identify agent from virtual key
  const agentContext = await identifyAgent(incomingHeaders.get("authorization"));

  if (!agentContext) {
    throw new ApiError(401, "unauthorized", {
      detail: "Missing or invalid SynthForce virtual key. Use Authorization: Bearer sf-key-…",
    });
  }

  // Virtual key must match the requested provider
  if (agentContext.providerName !== provider) {
    throw new ApiError(400, "provider_mismatch", {
      detail: `Virtual key is for provider "${agentContext.providerName}", not "${provider}".`,
    });
  }

  if (!agentContext.providerApiBaseUrl) {
    throw new ApiError(500, "provider_misconfigured", {
      detail: `Provider "${provider}" has no base URL configured.`,
    });
  }

  const url = `${agentContext.providerApiBaseUrl}${path}`;
  const providerHeaders = buildProviderHeaders(
    agentContext.providerName,
    agentContext.providerApiKey,
    incomingHeaders,
  );

  const upstream = await fetch(url, {
    method,
    headers: providerHeaders,
    body: body,
    // @ts-expect-error - Node 18+ fetch supports duplex for streaming request bodies
    duplex: body ? "half" : undefined,
    signal: AbortSignal.timeout(120_000),
  });

  return { response: upstream, agentContext };
}

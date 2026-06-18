import { prisma } from "@/lib/db";
import { calculateCostCents } from "@/lib/providers/pricing";
import type { AgentContext } from "./identify-agent";

function extractModel(parsedBody: unknown): string | null {
  if (parsedBody && typeof parsedBody === "object" && "model" in parsedBody) {
    const m = (parsedBody as Record<string, unknown>).model;
    return typeof m === "string" ? m : null;
  }
  return null;
}

// Rough character-based estimate for when provider doesn't report token counts.
function estimateTokens(parsedBody: unknown): number {
  if (!parsedBody) return 0;
  try { return Math.ceil(JSON.stringify(parsedBody).length / 4); } catch { return 0; }
}

function parseUsageFromResponse(parsedResponse: unknown): { tokensIn: number; tokensOut: number } {
  if (!parsedResponse || typeof parsedResponse !== "object") return { tokensIn: 0, tokensOut: 0 };
  const resp = parsedResponse as Record<string, unknown>;
  const usage = resp.usage;
  if (!usage || typeof usage !== "object") return { tokensIn: 0, tokensOut: 0 };
  const u = usage as Record<string, unknown>;

  // OpenAI: prompt_tokens / completion_tokens
  // Anthropic: input_tokens / output_tokens
  const tokensIn  = (typeof u.prompt_tokens     === "number" ? u.prompt_tokens     : 0)
                  + (typeof u.input_tokens       === "number" ? u.input_tokens       : 0);
  const tokensOut = (typeof u.completion_tokens  === "number" ? u.completion_tokens  : 0)
                  + (typeof u.output_tokens      === "number" ? u.output_tokens      : 0);

  return { tokensIn, tokensOut };
}

/**
 * Extract token usage from a Server-Sent Events (SSE) stream body.
 *
 * We read the full cloned stream (the original, piped to the caller, is
 * untouched) and scan every `data:` event for usage. Providers report usage in
 * different events/shapes:
 *   - OpenAI (stream_options.include_usage): a final chunk with top-level `usage`.
 *   - Anthropic: `message_start` carries `message.usage.input_tokens`; the
 *     `message_delta` carries the final cumulative `usage.output_tokens`.
 * We take the max seen for each direction, which yields the final totals
 * regardless of which event carried them.
 */
export function parseStreamingUsage(sseText: string): { tokensIn: number; tokensOut: number } {
  let tokensIn = 0;
  let tokensOut = 0;

  for (const line of sseText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    let obj: unknown;
    try { obj = JSON.parse(payload); } catch { continue; }

    // Usage can sit at the top level (OpenAI) or under `message` (Anthropic).
    const nested = (obj as { message?: unknown })?.message;
    for (const candidate of [obj, nested]) {
      const { tokensIn: ti, tokensOut: to } = parseUsageFromResponse(candidate);
      if (ti > tokensIn) tokensIn = ti;
      if (to > tokensOut) tokensOut = to;
    }
  }

  return { tokensIn, tokensOut };
}

/**
 * Fire-and-forget usage log write.
 *
 * Call with response.clone() so the original stream is unaffected — we can then
 * fully read the clone (including SSE streams) to recover token usage.
 */
export async function logProxyResponse(
  responseClone: Response,
  agentContext: AgentContext,
  parsedBody: unknown,
): Promise<void> {
  const model      = extractModel(parsedBody);
  const isStreaming = responseClone.headers.get("content-type")?.includes("text/event-stream") ?? false;

  try {
    const text = await responseClone.text();
    let tokensIn: number;
    let tokensOut: number;

    if (isStreaming) {
      // The clone is independent of the streamed response, so reading it here
      // does not affect what the caller receives.
      const usage = parseStreamingUsage(text);
      tokensIn  = usage.tokensIn  || estimateTokens(parsedBody);
      tokensOut = usage.tokensOut;
    } else {
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { /* binary or non-JSON body */ }

      const usage = parseUsageFromResponse(parsed);
      tokensIn  = usage.tokensIn  || estimateTokens(parsedBody);
      tokensOut = usage.tokensOut;
    }

    const costCents = calculateCostCents(agentContext.providerName, model, tokensIn, tokensOut);
    const durationMs = Date.now() - agentContext.timestamp.getTime();

    await prisma.usageLog.create({
      data: {
        companyId:  agentContext.companyId,
        agentId:    agentContext.agentId,
        providerId: agentContext.providerId,
        tokensIn,
        tokensOut,
        costCents,
        durationMs,
        statusCode: responseClone.status,
        wasBlocked: false,
        metadata: { model, streaming: isStreaming, requestId: agentContext.requestId },
      },
    });
  } catch (err) {
    // Never let logging failure break the proxy response.
    console.error("[log-response] write failed:", err);
  }
}

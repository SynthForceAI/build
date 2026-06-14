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
 * Fire-and-forget usage log write.
 *
 * Call with response.clone() so the original stream is unaffected.
 * For SSE/streaming responses we log what we know from the request side only.
 */
export async function logProxyResponse(
  responseClone: Response,
  agentContext: AgentContext,
  parsedBody: unknown,
): Promise<void> {
  const model      = extractModel(parsedBody);
  const isStreaming = responseClone.headers.get("content-type")?.includes("text/event-stream") ?? false;

  try {
    let tokensIn: number;
    let tokensOut: number;

    if (isStreaming) {
      // Can't parse SSE chunks without consuming the stream.
      // Log request-side estimate; tokensOut stays 0 for now.
      tokensIn  = estimateTokens(parsedBody);
      tokensOut = 0;
    } else {
      const text = await responseClone.text();
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

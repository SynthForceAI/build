import { describe, expect, it, vi } from "vitest";

// log-response imports prisma (db) and pricing; we only test the pure SSE
// parser, so stub the db module to avoid loading env/Prisma.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { parseStreamingUsage } from "@/lib/proxy/middleware/log-response";

describe("parseStreamingUsage", () => {
  it("reads usage from an OpenAI streaming final chunk", () => {
    const sse = [
      `data: {"choices":[{"delta":{"content":"hi"}}]}`,
      `data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":34,"total_tokens":46}}`,
      `data: [DONE]`,
      ``,
    ].join("\n");

    expect(parseStreamingUsage(sse)).toEqual({ tokensIn: 12, tokensOut: 34 });
  });

  it("reads usage from Anthropic message_start + message_delta events", () => {
    const sse = [
      `event: message_start`,
      `data: {"type":"message_start","message":{"usage":{"input_tokens":25,"output_tokens":1}}}`,
      `event: message_delta`,
      `data: {"type":"message_delta","usage":{"output_tokens":40}}`,
      `event: message_stop`,
      `data: {"type":"message_stop"}`,
      ``,
    ].join("\n");

    // input from message_start, final cumulative output from message_delta
    expect(parseStreamingUsage(sse)).toEqual({ tokensIn: 25, tokensOut: 40 });
  });

  it("returns zeros when no usage is present and ignores malformed lines", () => {
    const sse = [
      `: comment`,
      `data: not-json`,
      `data: {"choices":[{"delta":{"content":"x"}}]}`,
      ``,
    ].join("\n");

    expect(parseStreamingUsage(sse)).toEqual({ tokensIn: 0, tokensOut: 0 });
  });
});

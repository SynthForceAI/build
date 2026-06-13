import { ApiError } from "@/lib/api-errors";
import { checkAgentPolicy } from "@/lib/proxy/policy-engine";

function extractModel(parsedBody: unknown): string | null {
  if (parsedBody && typeof parsedBody === "object" && "model" in parsedBody) {
    const m = (parsedBody as Record<string, unknown>).model;
    return typeof m === "string" ? m : null;
  }
  return null;
}

export async function enforcePolicy(
  agentId: string,
  method: string,
  parsedBody: unknown,
): Promise<void> {
  const model = extractModel(parsedBody);

  const result = await checkAgentPolicy(agentId, model, method, parsedBody);

  if (!result.allowed) {
    throw new ApiError(result.statusCode, "policy_violation", {
      detail: result.reason,
    });
  }
}

import { verifyOpenAiKey, verifyOpenAiAdminKey } from "./openai-connector";
import { verifyAnthropicKey, verifyAnthropicAdminKey } from "./anthropic-connector";
import { verifyGeminiKey } from "./gemini-connector";
import { verifyDeepseekKey } from "./deepseek-connector";
import { isDemoKey } from "../audit/demo-data";

export async function verifyProviderKey(
  providerName: string,
  apiKey: string,
  keyType: "personal" | "admin" = "personal",
): Promise<string[]> {
  if (isDemoKey(apiKey)) return ["gpt-4", "gpt-4o", "gpt-4o-mini", "o1-preview"];

  switch (providerName) {
    case "openai":
      return keyType === "admin" ? verifyOpenAiAdminKey(apiKey) : verifyOpenAiKey(apiKey);
    case "anthropic":     return keyType === "admin" ? verifyAnthropicAdminKey(apiKey) : verifyAnthropicKey(apiKey);
    case "google-gemini": return verifyGeminiKey(apiKey);
    case "deepseek":      return verifyDeepseekKey(apiKey);
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}

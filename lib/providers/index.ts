import { verifyOpenAiKey, verifyOpenAiAdminKey } from "./openai-connector";
import { verifyAnthropicKey } from "./anthropic-connector";
import { verifyGeminiKey } from "./gemini-connector";
import { verifyDeepseekKey } from "./deepseek-connector";

export async function verifyProviderKey(
  providerName: string,
  apiKey: string,
  keyType: "personal" | "admin" = "personal",
): Promise<string[]> {
  switch (providerName) {
    case "openai":
      return keyType === "admin" ? verifyOpenAiAdminKey(apiKey) : verifyOpenAiKey(apiKey);
    case "anthropic":     return verifyAnthropicKey(apiKey);
    case "google-gemini": return verifyGeminiKey(apiKey);
    case "deepseek":      return verifyDeepseekKey(apiKey);
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}

import { verifyOpenAiKey } from "./openai-connector";
import { verifyAnthropicKey } from "./anthropic-connector";
import { verifyGeminiKey } from "./gemini-connector";
import { verifyDeepseekKey } from "./deepseek-connector";

export async function verifyProviderKey(
  providerName: string,
  apiKey: string,
): Promise<string[]> {
  switch (providerName) {
    case "openai":        return verifyOpenAiKey(apiKey);
    case "anthropic":     return verifyAnthropicKey(apiKey);
    case "google-gemini": return verifyGeminiKey(apiKey);
    case "deepseek":      return verifyDeepseekKey(apiKey);
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}

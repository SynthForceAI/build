/**
 * Hardcoded per-model token pricing, used to estimate cost when an agent
 * self-reports token counts without a cost, and as a sanity check against
 * provider-reported costs.
 *
 * Prices are USD per 1,000,000 tokens (the unit every provider publishes).
 * Keep this table close to provider pricing pages; it is intentionally a
 * coarse estimate, not a billing source of truth. The Open Question in the
 * spec (hardcoded vs. provider reconciliation) is resolved as: hardcoded
 * here, reconciled later by the polling job's provider-reported costs.
 */

export type ModelPrice = {
  /** USD per 1M input/prompt tokens. */
  inputPerMillion: number;
  /** USD per 1M output/completion tokens. */
  outputPerMillion: number;
};

// Keyed by provider name (matches Provider.name) then by a model-id prefix.
// We match on the longest prefix so "gpt-4o-mini" wins over "gpt-4o".
const PRICING: Record<string, Record<string, ModelPrice>> = {
  openai: {
    "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
    "gpt-4o":      { inputPerMillion: 2.5,  outputPerMillion: 10 },
    "gpt-4.1-mini":{ inputPerMillion: 0.4,  outputPerMillion: 1.6 },
    "gpt-4.1":     { inputPerMillion: 2,    outputPerMillion: 8 },
    "o3-mini":     { inputPerMillion: 1.1,  outputPerMillion: 4.4 },
    "o3":          { inputPerMillion: 2,    outputPerMillion: 8 },
  },
  anthropic: {
    "claude-3-5-haiku":  { inputPerMillion: 0.8, outputPerMillion: 4 },
    "claude-3-5-sonnet": { inputPerMillion: 3,   outputPerMillion: 15 },
    "claude-3-7-sonnet": { inputPerMillion: 3,   outputPerMillion: 15 },
    "claude-3-opus":     { inputPerMillion: 15,  outputPerMillion: 75 },
    "claude-haiku":      { inputPerMillion: 0.8, outputPerMillion: 4 },
    "claude-sonnet":     { inputPerMillion: 3,   outputPerMillion: 15 },
    "claude-opus":       { inputPerMillion: 15,  outputPerMillion: 75 },
  },
  "google-gemini": {
    "gemini-1.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
    "gemini-1.5-pro":   { inputPerMillion: 1.25,  outputPerMillion: 5 },
    "gemini-2.0-flash": { inputPerMillion: 0.1,   outputPerMillion: 0.4 },
    "gemini-2.5-pro":   { inputPerMillion: 1.25,  outputPerMillion: 5 },
  },
  deepseek: {
    "deepseek-chat":     { inputPerMillion: 0.27, outputPerMillion: 1.1 },
    "deepseek-reasoner": { inputPerMillion: 0.55, outputPerMillion: 2.19 },
    "deepseek":          { inputPerMillion: 0.27, outputPerMillion: 1.1 },
  },
};

/** Find the price for a (provider, model) pair by longest-prefix match. */
export function priceFor(providerName: string, model: string | null | undefined): ModelPrice | null {
  const table = PRICING[providerName];
  if (!table) return null;
  if (!model) {
    // Fall back to the cheapest entry so we never silently price at 0 for a
    // known provider — better to under-bill than to show "$0.00 forever".
    return Object.values(table)[0] ?? null;
  }
  const m = model.toLowerCase();
  let best: { len: number; price: ModelPrice } | null = null;
  for (const [prefix, price] of Object.entries(table)) {
    if (m.startsWith(prefix) && (!best || prefix.length > best.len)) {
      best = { len: prefix.length, price };
    }
  }
  return best?.price ?? Object.values(table)[0] ?? null;
}

/**
 * Estimate cost in cents (may be fractional) for a token usage event.
 * Returns 0 when we have no pricing for the provider/model — callers should
 * treat 0 as "unknown" rather than "free".
 */
export function calculateCostCents(
  providerName: string,
  model: string | null | undefined,
  tokensIn: number,
  tokensOut: number,
): number {
  const price = priceFor(providerName, model);
  if (!price) return 0;
  const usd =
    (tokensIn / 1_000_000) * price.inputPerMillion +
    (tokensOut / 1_000_000) * price.outputPerMillion;
  return usd * 100;
}

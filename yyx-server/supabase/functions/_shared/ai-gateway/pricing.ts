/**
 * AI Gateway - Pricing
 *
 * Static model pricing map. Single source of truth for cost estimation.
 *
 * When model pricing changes:
 * 1. Update MODEL_PRICING below
 * 2. Redeploy edge functions
 */

/** Per-million-token pricing for known models. */
export const MODEL_PRICING: Record<
  string,
  { inputPricePerMillion: number; outputPricePerMillion: number }
> = {
  "gpt-4.1": { inputPricePerMillion: 2.00, outputPricePerMillion: 8.00 },
  "gpt-4.1-nano": {
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
  },
  "gpt-4.1-mini": {
    inputPricePerMillion: 0.40,
    outputPricePerMillion: 1.60,
  },
  "gemini-2.5-flash": {
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
  },
  "gemini-3-flash-preview": {
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 3.00,
  },
  "grok-4-1-fast-non-reasoning": {
    inputPricePerMillion: 0.20,
    outputPricePerMillion: 0.50,
  },
  "text-embedding-3-large": {
    inputPricePerMillion: 0.13,
    outputPricePerMillion: 0,
  },
};

/**
 * Get pricing for a model. For unknown models, falls back to the most
 * expensive model in the map (safe by default — overcharge, not undercharge).
 */
function getModelPricing(
  model: string,
): { inputPricePerMillion: number; outputPricePerMillion: number } {
  const exact = MODEL_PRICING[model];
  if (exact) return exact;

  // Unknown model — fall back to most expensive
  let mostExpensive = { inputPricePerMillion: 0, outputPricePerMillion: 0 };
  let highestCost = 0;
  for (const pricing of Object.values(MODEL_PRICING)) {
    const total = pricing.inputPricePerMillion + pricing.outputPricePerMillion;
    if (total > highestCost) {
      highestCost = total;
      mostExpensive = pricing;
    }
  }

  console.warn(
    `[ai-gateway:pricing] Unknown model '${model}', using most expensive pricing`,
  );
  return mostExpensive;
}

/**
 * Calculate cost in USD for a given model and token usage.
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getModelPricing(model);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) *
    pricing.outputPricePerMillion;
  return inputCost + outputCost;
}

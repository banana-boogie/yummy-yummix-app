/**
 * AI Gateway - Pricing
 *
 * DB-backed model pricing with in-memory caching.
 * Calculates cost per AI call based on token usage.
 */

import { createServiceClient } from "../supabase-client.ts";

interface ModelPricing {
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

const STATIC_FALLBACK_PRICING: Record<
  string,
  { inputPricePerMillion: number; outputPricePerMillion: number }
> = {
  "gemini-2.5-flash": {
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
  },
  "gpt-4.1-nano": { inputPricePerMillion: 0.10, outputPricePerMillion: 0.40 },
  "gpt-4.1-mini": { inputPricePerMillion: 0.40, outputPricePerMillion: 1.60 },
  "text-embedding-3-large": {
    inputPricePerMillion: 0.13,
    outputPricePerMillion: 0,
  },
};

// Module-level cache: model → pricing. Shared across requests in a warm instance.
const pricingCache = new Map<string, ModelPricing>();
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Load pricing from DB into cache. Called lazily on first use or after TTL.
 */
async function loadPricingCache(): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ai_model_pricing")
      .select("model, input_price_per_million, output_price_per_million");

    if (error) {
      console.error(
        "[ai-gateway:pricing] Failed to load pricing:",
        error.message,
      );
      return;
    }

    if (!data || data.length === 0) {
      console.warn(
        "[ai-gateway:pricing] No pricing data in ai_model_pricing table",
      );
      return;
    }

    pricingCache.clear();
    for (const row of data) {
      pricingCache.set(row.model, {
        model: row.model,
        inputPricePerMillion: Number(row.input_price_per_million),
        outputPricePerMillion: Number(row.output_price_per_million),
      });
    }
    cacheLoadedAt = Date.now();
    console.log(
      `[ai-gateway:pricing] Loaded ${pricingCache.size} model prices`,
    );
  } catch (err) {
    console.error("[ai-gateway:pricing] Cache load error:", err);
  }
}

/**
 * Ensure cache is populated and fresh.
 */
async function ensureCache(): Promise<void> {
  if (pricingCache.size === 0 || Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await loadPricingCache();
  }
}

/**
 * Get pricing for a model. Falls back to the most expensive cached model
 * if the exact model is unknown (safe by default — overcharge, not undercharge).
 */
async function getModelPricing(model: string): Promise<ModelPricing> {
  await ensureCache();

  const exact = pricingCache.get(model);
  if (exact) return exact;

  const staticExact = STATIC_FALLBACK_PRICING[model];
  if (staticExact) {
    console.warn(
      `[ai-gateway:pricing] Using static fallback pricing for '${model}'`,
    );
    return {
      model,
      inputPricePerMillion: staticExact.inputPricePerMillion,
      outputPricePerMillion: staticExact.outputPricePerMillion,
    };
  }

  // Fallback: use the most expensive cached model
  if (pricingCache.size > 0) {
    let mostExpensive: ModelPricing | null = null;
    let highestCost = 0;
    for (const pricing of pricingCache.values()) {
      const totalCost = pricing.inputPricePerMillion +
        pricing.outputPricePerMillion;
      if (totalCost > highestCost) {
        highestCost = totalCost;
        mostExpensive = pricing;
      }
    }
    if (mostExpensive) {
      console.warn(
        `[ai-gateway:pricing] Unknown model '${model}', falling back to '${mostExpensive.model}' pricing`,
      );
      return mostExpensive;
    }
  }

  // No DB cache available: fallback to most expensive static model pricing
  let staticFallback: ModelPricing | null = null;
  let highestStaticCost = 0;
  for (
    const [fallbackModel, pricing] of Object.entries(STATIC_FALLBACK_PRICING)
  ) {
    const totalCost = pricing.inputPricePerMillion +
      pricing.outputPricePerMillion;
    if (totalCost > highestStaticCost) {
      highestStaticCost = totalCost;
      staticFallback = {
        model: fallbackModel,
        inputPricePerMillion: pricing.inputPricePerMillion,
        outputPricePerMillion: pricing.outputPricePerMillion,
      };
    }
  }

  if (staticFallback) {
    console.warn(
      `[ai-gateway:pricing] No DB pricing available, using static fallback '${staticFallback.model}' for unknown model '${model}'`,
    );
    return staticFallback;
  }

  // Last resort should never happen with populated STATIC_FALLBACK_PRICING
  console.warn(
    `[ai-gateway:pricing] Static fallback pricing missing, returning zero cost for '${model}'`,
  );
  return { model, inputPricePerMillion: 0, outputPricePerMillion: 0 };
}

/**
 * Calculate cost in USD for a given model and token usage.
 */
export async function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): Promise<number> {
  const pricing = await getModelPricing(model);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;
  return inputCost + outputCost;
}

/** Exported for testing */
export function _clearCache(): void {
  pricingCache.clear();
  cacheLoadedAt = 0;
}

/** Exported for testing */
export function _setCacheForTesting(
  pricing: Array<{
    model: string;
    inputPricePerMillion: number;
    outputPricePerMillion: number;
  }>,
): void {
  pricingCache.clear();
  for (const row of pricing) {
    pricingCache.set(row.model, {
      model: row.model,
      inputPricePerMillion: row.inputPricePerMillion,
      outputPricePerMillion: row.outputPricePerMillion,
    });
  }
  cacheLoadedAt = Date.now();
}

/**
 * AI usage logging utility for customer-facing AI cost tracking.
 *
 * This logger is intentionally fire-and-forget. It should never block user responses.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createServiceClient } from "./supabase-client.ts";

export const PRICING_VERSION = 1;

const MODEL_PRICING_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "o1-mini": { input: 3.00, output: 12.00 },
  "o1": { input: 15.00, output: 60.00 },
};

const ALLOWED_METADATA_KEYS = new Set([
  "streaming",
  "tool_names",
  "request_type",
  "forced_tool_use",
  "source",
  "has_tool_calls",
  "timeout",
]);

export type UsageLogStatus = "success" | "partial" | "error";

export interface UsageLogParams {
  userId: string;
  sessionId?: string;
  requestId: string;
  callPhase:
    | "tool_decision"
    | "response_stream"
    | "recipe_generation"
    | "modification";
  attempt?: number;
  status?: UsageLogStatus;
  functionName: string;
  usageType: string;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = resolvePricing(model);
  if (!pricing) return null;

  const inputCost = (inputTokens * pricing.input) / 1_000_000;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;
  return inputCost + outputCost;
}

function resolvePricing(
  model: string,
): { input: number; output: number } | null {
  const normalized = model.trim().toLowerCase();
  const candidates = Object.keys(MODEL_PRICING_PER_MILLION)
    .sort((a, b) => b.length - a.length);

  for (const baseModel of candidates) {
    if (normalized === baseModel || normalized.startsWith(`${baseModel}-`)) {
      return MODEL_PRICING_PER_MILLION[baseModel];
    }
  }

  return null;
}

export function sanitizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> {
  if (!metadata) return {};

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;

    if (key === "tool_names" && Array.isArray(value)) {
      safe[key] = value.filter((item) => typeof item === "string").slice(0, 20);
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

export async function logAIUsageWithClient(
  client: SupabaseClient,
  params: UsageLogParams,
): Promise<void> {
  const attempt = params.attempt ?? 0;
  const status = params.status ?? "success";

  const hasTokenUsage = typeof params.inputTokens === "number" &&
    typeof params.outputTokens === "number";

  const estimatedCostUsd = params.model && hasTokenUsage
    ? estimateCostUsd(params.model, params.inputTokens!, params.outputTokens!)
    : null;

  const row = {
    user_id: params.userId,
    session_id: params.sessionId ?? null,
    request_id: params.requestId,
    call_phase: params.callPhase,
    attempt,
    status,
    function_name: params.functionName,
    usage_type: params.usageType,
    model: params.model ?? null,
    input_tokens: params.inputTokens ?? null,
    output_tokens: params.outputTokens ?? null,
    estimated_cost_usd: estimatedCostUsd,
    pricing_version: PRICING_VERSION,
    duration_ms: params.durationMs ?? null,
    metadata: sanitizeMetadata(params.metadata),
  };

  const { error } = await client
    .from("ai_usage_logs")
    .upsert(row, {
      onConflict: "request_id,call_phase,attempt",
      ignoreDuplicates: true,
    });

  if (error) {
    throw error;
  }
}

export async function logAIUsage(params: UsageLogParams): Promise<void> {
  try {
    const client = createServiceClient();
    await logAIUsageWithClient(client, params);
  } catch (error) {
    // Must never block request processing.
    console.error(
      "[usage-logger] Failed to persist AI usage",
      error instanceof Error ? error.message : String(error),
    );
  }
}

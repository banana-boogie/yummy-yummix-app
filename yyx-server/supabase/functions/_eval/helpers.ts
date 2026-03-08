/**
 * AI Model Tournament — Helpers
 *
 * Provider dispatch, retry logic, cost calculation, and utilities.
 */

import type {
  AICompletionRequest,
  AICompletionResponse,
} from "../_shared/ai-gateway/types.ts";
import { callOpenAI } from "../_shared/ai-gateway/providers/openai.ts";
import { callGemini } from "../_shared/ai-gateway/providers/google.ts";
import { callAnthropic } from "../_shared/ai-gateway/providers/anthropic.ts";
import { callXAI } from "../_shared/ai-gateway/providers/xai.ts";
import type { AttemptDetail, ModelConfig } from "./types.ts";

// ============================================================
// API Key Loading
// ============================================================

export interface ApiKeys {
  [envVar: string]: string | undefined;
}

const API_KEY_ENV_VARS = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "XAI_API_KEY",
];

export function loadApiKeys(): ApiKeys {
  const keys: ApiKeys = {};
  for (const envVar of API_KEY_ENV_VARS) {
    keys[envVar] = Deno.env.get(envVar);
  }
  return keys;
}

// ============================================================
// Provider Dispatch
// ============================================================

export async function callModel(
  config: ModelConfig,
  request: AICompletionRequest,
  apiKey: string,
): Promise<AICompletionResponse> {
  switch (config.provider) {
    case "openai":
      return await callOpenAI(request, config.id, apiKey);
    case "google":
      return await callGemini(request, config.id, apiKey);
    case "anthropic":
      return await callAnthropic(request, config.id, apiKey);
    case "xai":
      return await callXAI(request, config.id, apiKey);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// ============================================================
// Retry Logic
// ============================================================

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 2000;
const TIMEOUT_MS = 60_000;

export function isTransientError(error: Error): boolean {
  // Provider errors use format: "Provider API error (503): ..."
  const statusMatch = error.message.match(/\((\d{3})\)/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1]);
    if (status === 429 || status >= 500) return true;
  }
  // Network/timeout errors
  return /network|timeout|ECONNREFUSED|ENOTFOUND|fetch failed|aborted/i.test(
    error.message,
  );
}

export interface CallModelWithRetryResult {
  response: AICompletionResponse;
  attempts: AttemptDetail[];
  totalLatencyMs: number;
  totalCostUsd: number;
}

export async function callModelWithRetry(
  config: ModelConfig,
  request: AICompletionRequest,
  apiKey: string,
): Promise<CallModelWithRetryResult> {
  const attempts: AttemptDetail[] = [];
  let totalCostUsd = 0;
  const overallStart = performance.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const attemptStart = performance.now();

    try {
      // Add timeout via AbortSignal
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const requestWithSignal = { ...request, signal: controller.signal };

      const response = await callModel(config, requestWithSignal, apiKey);
      clearTimeout(timeoutId);

      const attemptLatency = Math.round(performance.now() - attemptStart);
      const attemptCost = calculateCost(
        config,
        response.usage.inputTokens,
        response.usage.outputTokens,
      );
      totalCostUsd += attemptCost;

      attempts.push({
        attemptNumber: attempt + 1,
        latencyMs: attemptLatency,
        costUsd: attemptCost,
      });

      return {
        response,
        attempts,
        totalLatencyMs: Math.round(performance.now() - overallStart),
        totalCostUsd,
      };
    } catch (error) {
      const attemptLatency = Math.round(performance.now() - attemptStart);
      const err = error instanceof Error ? error : new Error(String(error));

      attempts.push({
        attemptNumber: attempt + 1,
        latencyMs: attemptLatency,
        costUsd: 0,
        error: err.message,
      });

      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(
          `  ⚠ Transient error (attempt ${
            attempt + 1
          }), retrying in ${backoff}ms: ${err.message}`,
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      throw err;
    }
  }

  // Should not reach here
  throw new Error("Exhausted retries");
}

// ============================================================
// Cost Calculation
// ============================================================

export function calculateCost(
  config: ModelConfig,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1_000_000) * config.pricing.inputPerMillion +
    (outputTokens / 1_000_000) * config.pricing.outputPerMillion
  );
}

// ============================================================
// Formatting Utilities
// ============================================================

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatCost(usd: number): string {
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

// ============================================================
// Git / Metadata Utilities
// ============================================================

export async function getGitSha(): Promise<string> {
  try {
    const cmd = new Deno.Command("git", {
      args: ["rev-parse", "--short", "HEAD"],
      stdout: "piped",
      stderr: "null",
    });
    const output = await cmd.output();
    return new TextDecoder().decode(output.stdout).trim();
  } catch {
    return "unknown";
  }
}

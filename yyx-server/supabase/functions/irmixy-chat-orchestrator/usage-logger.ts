/**
 * Usage Logger
 *
 * Fires AI usage log entries for orchestrator phases. Keeps index.ts DRY.
 */

import type { AIUsageLogContext } from "../_shared/tools/generate-custom-recipe.ts";
import { logAIUsage } from "../_shared/usage-logger.ts";

/** Build and fire a usage log entry. */
export function fireUsageLog(
  ctx: AIUsageLogContext,
  phase: "tool_decision" | "response_stream",
  status: "success" | "error",
  startTime: number,
  result?: {
    model: string;
    usage: { inputTokens: number; outputTokens: number };
  },
  metadata?: Record<string, unknown>,
): void {
  // Detect missing/zero stream usage — treat as partial rather than fake success
  const hasUsage = result != null &&
    (result.usage.inputTokens > 0 || result.usage.outputTokens > 0);
  const effectiveStatus = status === "success" && result != null && !hasUsage
    ? "partial"
    : status;

  void logAIUsage({
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    callPhase: phase,
    status: effectiveStatus,
    functionName: ctx.functionName,
    usageType: "text",
    model: result?.model ?? null,
    inputTokens: hasUsage ? result!.usage.inputTokens : null,
    outputTokens: hasUsage ? result!.usage.outputTokens : null,
    durationMs: Math.round(performance.now() - startTime),
    metadata: { streaming: phase === "response_stream", ...metadata },
  });
}

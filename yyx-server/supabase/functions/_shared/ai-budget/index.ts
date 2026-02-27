/**
 * AI Budget Module
 *
 * Provides budget checking and cost recording for AI usage.
 * Text chat uses cost-based budgets; voice uses minute-based quotas.
 * Both are tiered by membership (free vs premium).
 */

import { createServiceClient } from "../supabase-client.ts";

// ============================================================
// Types
// ============================================================

export interface BudgetStatus {
  allowed: boolean;
  remainingUsd: number;
  usedUsd: number;
  budgetUsd: number;
  tier: string;
  warning?: string;
}

export interface VoiceBudgetStatus {
  allowed: boolean;
  remainingMinutes: number;
  usedMinutes: number;
  limitMinutes: number;
  tier: string;
  warning?: string;
}

export interface CostRecord {
  userId: string;
  model: string;
  usageType: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  edgeFunction: string;
  metadata?: Record<string, unknown>;
}

interface TierLimits {
  monthlyTextBudgetUsd: number;
  monthlyVoiceMinutes: number;
}

// ============================================================
// Tier Cache (1hr TTL, shared across requests in warm instance)
// ============================================================

const tierCache = new Map<string, TierLimits>();
let tierCacheLoadedAt = 0;
const TIER_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function ensureTierCache(): Promise<void> {
  if (
    tierCache.size > 0 && Date.now() - tierCacheLoadedAt < TIER_CACHE_TTL_MS
  ) {
    return;
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ai_membership_tiers")
      .select("tier, monthly_text_budget_usd, monthly_voice_minutes");

    if (error) {
      console.error("[ai-budget] Failed to load tiers:", error.message);
      return;
    }

    tierCache.clear();
    for (const row of data || []) {
      tierCache.set(row.tier, {
        monthlyTextBudgetUsd: Number(row.monthly_text_budget_usd),
        monthlyVoiceMinutes: Number(row.monthly_voice_minutes),
      });
    }
    tierCacheLoadedAt = Date.now();
    console.log(`[ai-budget] Loaded ${tierCache.size} membership tiers`);
  } catch (err) {
    console.error("[ai-budget] Tier cache load error:", err);
  }
}

function getTierLimits(tier: string): TierLimits {
  const limits = tierCache.get(tier);
  if (limits) return limits;

  // Fallback to free tier if unknown
  const free = tierCache.get("free");
  if (free) {
    console.warn(`[ai-budget] Unknown tier '${tier}', falling back to 'free'`);
    return free;
  }

  // Hardcoded fallback if cache is empty
  console.warn(
    "[ai-budget] No tier data in cache, using hardcoded free defaults",
  );
  return { monthlyTextBudgetUsd: 0.10, monthlyVoiceMinutes: 5 };
}

// ============================================================
// Budget Checks
// ============================================================

const WARNING_THRESHOLD = 0.8; // Warn at 80% usage

/**
 * Check if user has remaining text/chat budget for the current month.
 */
export async function checkTextBudget(userId: string): Promise<BudgetStatus> {
  const supabase = createServiceClient();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Fetch in parallel: user tier + current month usage
  const [tierResult, usageResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("membership_tier")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("ai_budget_usage")
      .select("total_cost_usd")
      .eq("user_id", userId)
      .eq("month", currentMonth)
      .single(),
  ]);

  await ensureTierCache();

  const tier = tierResult.data?.membership_tier || "free";
  const limits = getTierLimits(tier);
  const usedUsd = Number(usageResult.data?.total_cost_usd || 0);
  const remainingUsd = Math.max(0, limits.monthlyTextBudgetUsd - usedUsd);
  const allowed = usedUsd < limits.monthlyTextBudgetUsd;

  const result: BudgetStatus = {
    allowed,
    remainingUsd,
    usedUsd,
    budgetUsd: limits.monthlyTextBudgetUsd,
    tier,
  };

  // Warning at 80% usage
  if (allowed && usedUsd >= limits.monthlyTextBudgetUsd * WARNING_THRESHOLD) {
    result.warning = `You've used $${usedUsd.toFixed(4)} of your $${
      limits.monthlyTextBudgetUsd.toFixed(2)
    } monthly AI budget.`;
  }

  return result;
}

/**
 * Check if user has remaining voice minutes for the current month.
 * Replaces the hardcoded QUOTA_LIMIT_MINUTES = 30 in voice orchestrator.
 */
export async function checkVoiceBudget(
  userId: string,
): Promise<VoiceBudgetStatus> {
  const supabase = createServiceClient();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [tierResult, usageResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("membership_tier")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("ai_voice_usage")
      .select("minutes_used")
      .eq("user_id", userId)
      .eq("month", currentMonth)
      .single(),
  ]);

  await ensureTierCache();

  const tier = tierResult.data?.membership_tier || "free";
  const limits = getTierLimits(tier);
  const usedMinutes = Number(usageResult.data?.minutes_used || 0);
  const remainingMinutes = Math.max(
    0,
    limits.monthlyVoiceMinutes - usedMinutes,
  );
  const allowed = usedMinutes < limits.monthlyVoiceMinutes;

  const result: VoiceBudgetStatus = {
    allowed,
    remainingMinutes,
    usedMinutes,
    limitMinutes: limits.monthlyVoiceMinutes,
    tier,
  };

  if (
    allowed && usedMinutes >= limits.monthlyVoiceMinutes * WARNING_THRESHOLD
  ) {
    result.warning = `You've used ${
      usedMinutes.toFixed(1)
    } of ${limits.monthlyVoiceMinutes} voice minutes this month.`;
  }

  return result;
}

// ============================================================
// Cost Recording
// ============================================================

/**
 * Record an AI call cost. Fire-and-forget — trigger handles aggregation.
 * Called automatically by the AI gateway when costContext is provided.
 */
export async function recordCost(record: CostRecord): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("ai_cost_log")
      .insert({
        user_id: record.userId,
        model: record.model,
        usage_type: record.usageType,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        cost_usd: record.costUsd,
        edge_function: record.edgeFunction,
        metadata: record.metadata || null,
      });

    if (error) {
      console.error("[ai-budget] Failed to record cost:", error.message);
    }
  } catch (err) {
    // Fire-and-forget: log but don't throw
    console.error("[ai-budget] recordCost error:", err);
  }
}

/** Exported for testing */
export function _clearTierCache(): void {
  tierCache.clear();
  tierCacheLoadedAt = 0;
}

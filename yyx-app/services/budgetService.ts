import { supabase } from '@/lib/supabase';
import logger from '@/services/logger';

export interface BudgetUsage {
  /** Percentage of budget used (0-100) */
  usagePercent: number;
  /** Total cost in USD for current month */
  totalCostUsd: number;
  /** Monthly budget limit in USD */
  budgetUsd: number;
  /** Number of requests this month */
  requestCount: number;
  /** User's membership tier */
  tier: string;
}

/**
 * Fetches the current user's AI budget usage for the current month.
 * Joins ai_budget_usage (user's spend) with ai_membership_tiers (tier limits)
 * via user_profiles (user's tier assignment).
 */
export async function fetchBudgetUsage(userId: string): Promise<BudgetUsage> {
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  // Fetch tier from user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('membership_tier')
    .eq('id', userId)
    .single();

  if (profileError) {
    logger.error('[budgetService] Failed to fetch profile:', profileError);
    throw profileError;
  }

  const tier = profile?.membership_tier ?? 'free';

  // Fetch tier limits
  const { data: tierData, error: tierError } = await supabase
    .from('ai_membership_tiers')
    .select('monthly_text_budget_usd')
    .eq('tier', tier)
    .maybeSingle();

  if (tierError) {
    logger.error('[budgetService] Failed to fetch tier limits:', tierError);
    throw tierError;
  }

  const budgetUsd = Number(tierData?.monthly_text_budget_usd ?? 0.10);

  // Fetch current month usage (may not exist if user hasn't used AI this month)
  const { data: usageData, error: usageError } = await supabase
    .from('ai_budget_usage')
    .select('total_cost_usd, request_count')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .maybeSingle();

  if (usageError) {
    logger.error('[budgetService] Failed to fetch usage:', usageError);
    throw usageError;
  }

  const totalCostUsd = Number(usageData?.total_cost_usd ?? 0);
  const requestCount = usageData?.request_count ?? 0;
  const usagePercent = budgetUsd > 0
    ? Math.min(Math.round((totalCostUsd / budgetUsd) * 100), 100)
    : 0;

  return {
    usagePercent,
    totalCostUsd,
    budgetUsd,
    requestCount,
    tier,
  };
}

export const budgetService = {
  fetchBudgetUsage,
};

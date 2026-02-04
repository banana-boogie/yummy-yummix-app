import { supabase } from '@/lib/supabase';

export type TimeframeFilter = 'today' | '7_days' | '30_days' | 'all_time';

async function fetchAdminAnalytics<T>(
  action: string,
  options?: { timeframe?: TimeframeFilter; limit?: number }
): Promise<T> {
  const { data, error } = await supabase.rpc('admin_analytics', {
    action,
    timeframe: options?.timeframe,
    limit_count: options?.limit,
  });

  if (error) {
    throw error;
  }

  return data as T;
}

export interface OverviewMetrics {
  dau: number;
  wau: number;
  mau: number;
  totalSignups: number;
  onboardingRate: number;
}

export interface RetentionMetrics {
  day1Retention: number;
  day7Retention: number;
  day30Retention: number;
  avgTimeToFirstCook: number | null;
  weeklyCookRate: number;
}

export interface FunnelMetrics {
  totalViews: number;
  totalStarts: number;
  totalCompletes: number;
  viewToStartRate: number;
  startToCompleteRate: number;
  overallConversionRate: number;
}

export interface TopRecipe {
  recipeId: string;
  recipeName: string;
  count: number;
}

export interface TopSearch {
  query: string;
  count: number;
}

export interface AIMetrics {
  aiAdoptionRate: number;
  totalChatSessions: number;
  totalVoiceSessions: number;
  aiUserCount: number;
  returnAIUsers: number;
}

export interface PatternMetrics {
  cookingByHour: { hour: number; count: number }[];
  languageSplit: { language: string; count: number }[];
}

export const analyticsService = {
  /**
   * Get overview metrics (DAU, WAU, MAU, signups, onboarding rate)
   */
  async getOverviewMetrics(): Promise<OverviewMetrics> {
    return fetchAdminAnalytics<OverviewMetrics>('overview');
  },

  /**
   * Get cooking funnel metrics
   */
  async getFunnelMetrics(timeframe: TimeframeFilter): Promise<FunnelMetrics> {
    return fetchAdminAnalytics<FunnelMetrics>('funnel', { timeframe });
  },

  /**
   * Get top viewed recipes
   */
  async getTopViewedRecipes(timeframe: TimeframeFilter, limit = 10): Promise<TopRecipe[]> {
    const data = await fetchAdminAnalytics<TopRecipe[]>('top_viewed_recipes', { timeframe, limit });
    return data ?? [];
  },

  /**
   * Get top cooked recipes
   */
  async getTopCookedRecipes(timeframe: TimeframeFilter, limit = 10): Promise<TopRecipe[]> {
    const data = await fetchAdminAnalytics<TopRecipe[]>('top_cooked_recipes', { timeframe, limit });
    return data ?? [];
  },

  /**
   * Get top search queries
   */
  async getTopSearches(timeframe: TimeframeFilter, limit = 10): Promise<TopSearch[]> {
    const data = await fetchAdminAnalytics<TopSearch[]>('top_searches', { timeframe, limit });
    return data ?? [];
  },

  /**
   * Get AI feature metrics
   */
  async getAIMetrics(): Promise<AIMetrics> {
    return fetchAdminAnalytics<AIMetrics>('ai');
  },

  /**
   * Get pattern metrics (cooking time of day, language split)
   */
  async getPatternMetrics(): Promise<PatternMetrics> {
    return fetchAdminAnalytics<PatternMetrics>('patterns');
  },

  /**
   * Get retention metrics (Day 1, 7, 30 retention)
   */
  async getRetentionMetrics(): Promise<RetentionMetrics> {
    return fetchAdminAnalytics<RetentionMetrics>('retention');
  },
};

export default analyticsService;

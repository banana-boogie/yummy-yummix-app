import { supabase } from '@/lib/supabase';

export type TimeframeFilter = 'today' | '7_days' | '30_days' | 'all_time';

export type AnalyticsAction =
  | 'overview'
  | 'retention'
  | 'funnel'
  | 'top_viewed_recipes'
  | 'top_cooked_recipes'
  | 'top_searches'
  | 'ai'
  | 'patterns'
  | 'recipe_generation';

async function fetchAdminAnalytics<T>(
  action: AnalyticsAction,
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

export interface RecipeGenerationMetrics {
  totalGenerated: number;
  totalFailed: number;
  successRate: number;
  avgDurationMs: number | null;
}

export interface AIUsageSummary {
  textRequests: number;
  textTokens: number;
  textCostUsd: number;
  voiceSessions: number;
  voiceMinutes: number;
  voiceCostUsd: number;
  totalCostUsd: number;
  uniqueAiUsers: number;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  avgCostPerUser: number;
  avgLatencyMs: number;
  errorRate: number;
}

export interface AIUsageMetrics {
  summary: AIUsageSummary;
  modelBreakdown: {
    model: string;
    requests: number;
    totalTokens: number;
    totalCostUsd: number;
  }[];
  dailyCost: {
    date: string;
    cost: number;
    requests: number;
  }[];
  phaseBreakdown: {
    phase: string;
    requests: number;
    avgTokens: number;
    errorRate: number;
  }[];
}

export interface AIChatSessionMetrics {
  avgMessagesPerSession: number;
  avgUserMessagesPerSession: number;
  avgAssistantMessagesPerSession: number;
  avgSessionDurationMin: number;
  totalSessions: number;
  messageDistribution: { bucket: string; count: number }[];
  toolUsage: {
    withSearch: number;
    withGeneration: number;
    withBoth: number;
    chatOnly: number;
  };
  sessionsExceedingWindow: number;
  topUsers: {
    userId: string;
    sessions: number;
    totalMessages: number;
    avgMessages: number;
  }[];
  dailySessions: { date: string; sessions: number }[];
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
  async getAIMetrics(timeframe: TimeframeFilter = '7_days'): Promise<AIMetrics> {
    return fetchAdminAnalytics<AIMetrics>('ai', { timeframe });
  },

  /**
   * Get AI usage and cost metrics.
   */
  async getAIUsageMetrics(timeframe: TimeframeFilter): Promise<AIUsageMetrics> {
    const { data, error } = await supabase.rpc('admin_ai_usage', { timeframe });

    if (error) {
      throw error;
    }

    return data as AIUsageMetrics;
  },

  /**
   * Get AI chat session depth metrics.
   */
  async getAIChatSessionMetrics(
    timeframe: TimeframeFilter = '7_days'
  ): Promise<AIChatSessionMetrics> {
    const { data, error } = await supabase.rpc('admin_ai_chat_session_depth', {
      timeframe,
    });
    if (error) throw error;
    return data as AIChatSessionMetrics;
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

  /**
   * Get recipe generation success/failure metrics.
   */
  async getRecipeGenerationMetrics(
    timeframe: TimeframeFilter
  ): Promise<RecipeGenerationMetrics> {
    return fetchAdminAnalytics<RecipeGenerationMetrics>('recipe_generation', { timeframe });
  },
};

export default analyticsService;

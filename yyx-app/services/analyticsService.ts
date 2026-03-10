import { supabase } from '@/lib/supabase';

export type TimeframeFilter = 'today' | '7_days' | '30_days' | 'all_time';

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
  totalStarts: number;
  totalCompletes: number;
  completionRate: number;
  catalogViews: number;
  catalogStarts: number;
  catalogConversionRate: number;
}

export interface TopRecipe {
  recipeId: string;
  recipeName: string;
  count: number;
  source: 'catalog' | 'user';
  userId: string | null;
  userName: string | null;
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
    displayName: string;
    sessions: number;
    totalMessages: number;
    avgMessages: number;
  }[];
  dailySessions: { date: string; sessions: number }[];
}

export interface DailySignups {
  date: string;
  signups: number;
  onboarded: number;
}

export interface DailyActiveUsers {
  date: string;
  users: number;
}

export interface DailyAIUsers {
  date: string;
  users: number;
}

export interface ContentSourceSplit {
  catalog: number;
  userGenerated: number;
}

export const analyticsService = {
  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const { data, error } = await supabase.rpc('admin_overview');
    if (error) throw error;
    return data as OverviewMetrics;
  },

  async getFunnelMetrics(timeframe: TimeframeFilter): Promise<FunnelMetrics> {
    const { data, error } = await supabase.rpc('admin_funnel', { timeframe });
    if (error) throw error;
    return data as FunnelMetrics;
  },

  async getTopViewedRecipes(timeframe: TimeframeFilter, limit = 10): Promise<TopRecipe[]> {
    const { data, error } = await supabase.rpc('admin_top_viewed_recipes', {
      timeframe,
      limit_count: limit,
    });
    if (error) throw error;
    return (data as TopRecipe[]) ?? [];
  },

  async getTopCookedRecipes(timeframe: TimeframeFilter, limit = 10): Promise<TopRecipe[]> {
    const { data, error } = await supabase.rpc('admin_top_cooked_recipes', {
      timeframe,
      limit_count: limit,
    });
    if (error) throw error;
    return (data as TopRecipe[]) ?? [];
  },

  async getTopSearches(timeframe: TimeframeFilter, limit = 10): Promise<TopSearch[]> {
    const { data, error } = await supabase.rpc('admin_top_searches', {
      timeframe,
      limit_count: limit,
    });
    if (error) throw error;
    return (data as TopSearch[]) ?? [];
  },

  async getAIMetrics(timeframe: TimeframeFilter = '7_days'): Promise<AIMetrics> {
    const { data, error } = await supabase.rpc('admin_ai_adoption', { timeframe });
    if (error) throw error;
    return data as AIMetrics;
  },

  async getAIUsageMetrics(timeframe: TimeframeFilter): Promise<AIUsageMetrics> {
    const { data, error } = await supabase.rpc('admin_ai_usage', { timeframe });
    if (error) throw error;
    return data as AIUsageMetrics;
  },

  async getAIChatSessionMetrics(
    timeframe: TimeframeFilter = '7_days'
  ): Promise<AIChatSessionMetrics> {
    const { data, error } = await supabase.rpc('admin_ai_chat_session_depth', {
      timeframe,
    });
    if (error) throw error;
    return data as AIChatSessionMetrics;
  },

  async getRetentionMetrics(): Promise<RetentionMetrics> {
    const { data, error } = await supabase.rpc('admin_retention');
    if (error) throw error;
    return data as RetentionMetrics;
  },

  async getDailySignups(timeframe: TimeframeFilter): Promise<DailySignups[]> {
    const { data, error } = await supabase.rpc('admin_daily_signups', { timeframe });
    if (error) throw error;
    return (data as DailySignups[]) ?? [];
  },

  async getDailyActiveUsers(timeframe: TimeframeFilter): Promise<DailyActiveUsers[]> {
    const { data, error } = await supabase.rpc('admin_daily_active_users', { timeframe });
    if (error) throw error;
    return (data as DailyActiveUsers[]) ?? [];
  },

  async getDailyAIUsers(timeframe: TimeframeFilter): Promise<DailyAIUsers[]> {
    const { data, error } = await supabase.rpc('admin_daily_ai_users', { timeframe });
    if (error) throw error;
    return (data as DailyAIUsers[]) ?? [];
  },

  async getContentSourceSplit(timeframe: TimeframeFilter): Promise<ContentSourceSplit> {
    const { data, error } = await supabase.rpc('admin_content_source_split', { timeframe });
    if (error) throw error;
    return data as ContentSourceSplit;
  },
};

export default analyticsService;

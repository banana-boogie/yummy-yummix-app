import { supabase } from '@/lib/supabase';

export type TimeframeFilter = '24h' | '7d' | '30d' | '90d' | 'all';

export type AnalyticsAction = 'overview' | 'engagement' | 'patterns';

async function fetchAdminAnalytics<T>(
  action: AnalyticsAction,
  options?: { timeframe?: TimeframeFilter; limit?: number }
): Promise<T> {
  const { data, error } = await supabase.rpc('admin_analytics', {
    action,
    timeframe: options?.timeframe,
    limit: options?.limit,
  });

  if (error) {
    throw error;
  }

  return data as T;
}

export interface OverviewMetrics {
  totalUsers: number;
  newUsers: number;
  onboardedUsers: number;
  totalRecipes: number;
  newRecipes: number;
  totalSessions: number;
  newSessions: number;
  activeUsers: number;
  totalMessages: number;
  newMessages: number;
}

export interface EngagementMetrics {
  topRecipes: { recipeId: string; recipeName: string; count: number }[];
  activeUsers: { name: string; email: string; messageCount: number; sessionCount: number }[];
}

export interface PatternMetrics {
  cookingByHour: { hour: number; count: number }[];
  languageSplit: { language: string; count: number }[];
}

export const analyticsService = {
  async getOverviewMetrics(timeframe: TimeframeFilter = '7d'): Promise<OverviewMetrics> {
    return fetchAdminAnalytics<OverviewMetrics>('overview', { timeframe });
  },

  async getEngagementMetrics(timeframe: TimeframeFilter = '7d', limit = 10): Promise<EngagementMetrics> {
    return fetchAdminAnalytics<EngagementMetrics>('engagement', { timeframe, limit });
  },

  async getPatternMetrics(timeframe: TimeframeFilter = '7d'): Promise<PatternMetrics> {
    return fetchAdminAnalytics<PatternMetrics>('patterns', { timeframe });
  },
};

export default analyticsService;

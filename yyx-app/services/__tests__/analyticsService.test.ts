import { analyticsService } from '../analyticsService';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

describe('analyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getOverviewMetrics calls admin_overview with no params', async () => {
    const mockData = {
      dau: 5,
      wau: 20,
      mau: 50,
      totalSignups: 100,
      onboardingRate: 75,
    };
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getOverviewMetrics();

    expect(supabase.rpc).toHaveBeenCalledWith('admin_overview');
    expect(result).toEqual(mockData);
  });

  it('getFunnelMetrics calls admin_funnel with timeframe', async () => {
    const mockData = {
      totalStarts: 50,
      totalCompletes: 25,
      completionRate: 50,
      catalogViews: 100,
      catalogStarts: 40,
      catalogConversionRate: 40,
    };
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getFunnelMetrics('30_days');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_funnel', { timeframe: '30_days' });
    expect(result).toEqual(mockData);
  });

  it('getTopViewedRecipes calls admin_top_viewed_recipes with timeframe and limit', async () => {
    const mockData = [{ recipeId: 'r1', recipeName: 'Tacos', count: 10, source: 'catalog', userId: null, userName: null }];
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getTopViewedRecipes('7_days', 5);

    expect(supabase.rpc).toHaveBeenCalledWith('admin_top_viewed_recipes', {
      timeframe: '7_days',
      limit_count: 5,
    });
    expect(result).toEqual(mockData);
  });

  it('getTopCookedRecipes calls admin_top_cooked_recipes with timeframe and limit', async () => {
    const mockData = [{ recipeId: 'r2', recipeName: 'Enchiladas', count: 8, source: 'user', userId: 'u1', userName: 'Maria' }];
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getTopCookedRecipes('today', 3);

    expect(supabase.rpc).toHaveBeenCalledWith('admin_top_cooked_recipes', {
      timeframe: 'today',
      limit_count: 3,
    });
    expect(result).toEqual(mockData);
  });

  it('getTopSearches calls admin_top_searches with timeframe and limit', async () => {
    const mockData = [{ query: 'tacos', count: 15 }];
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getTopSearches('all_time', 20);

    expect(supabase.rpc).toHaveBeenCalledWith('admin_top_searches', {
      timeframe: 'all_time',
      limit_count: 20,
    });
    expect(result).toEqual(mockData);
  });

  it('getAIMetrics calls admin_ai_adoption with timeframe', async () => {
    const mockData = {
      aiAdoptionRate: 35,
      totalChatSessions: 100,
      totalVoiceSessions: 20,
      aiUserCount: 45,
      returnAIUsers: 12,
    };
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getAIMetrics('30_days');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_ai_adoption', { timeframe: '30_days' });
    expect(result).toEqual(mockData);
  });

  it('getAIUsageMetrics calls admin_ai_usage RPC with timeframe', async () => {
    const mockResponse = {
      summary: {
        textRequests: 10,
        textTokens: 5000,
        textCostUsd: 1.2,
        voiceSessions: 3,
        voiceMinutes: 5.5,
        voiceCostUsd: 0.8,
        totalCostUsd: 2.0,
        uniqueAiUsers: 7,
        avgTokensPerRequest: 500,
        avgCostPerRequest: 0.12,
        avgCostPerUser: 0.28,
        avgLatencyMs: 930,
        errorRate: 4.2,
      },
      modelBreakdown: [],
      dailyCost: [],
      phaseBreakdown: [],
    };

    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockResponse, error: null });

    const result = await analyticsService.getAIUsageMetrics('7_days');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_ai_usage', { timeframe: '7_days' });
    expect(result).toEqual(mockResponse);
  });

  it('getAIChatSessionMetrics calls admin_ai_chat_session_depth RPC with timeframe', async () => {
    const mockResponse = {
      avgMessagesPerSession: 5.8,
      avgUserMessagesPerSession: 2.9,
      avgAssistantMessagesPerSession: 2.9,
      avgSessionDurationMin: 12.0,
      totalSessions: 141,
      messageDistribution: [
        { bucket: '2-4', count: 80 },
        { bucket: '5-10', count: 40 },
      ],
      toolUsage: { withSearch: 45, withGeneration: 60, withBoth: 20, chatOnly: 16 },
      sessionsExceedingWindow: 3,
      topUsers: [{ userId: 'abc', displayName: 'Maria Garcia', sessions: 12, totalMessages: 84, avgMessages: 7.0 }],
      dailySessions: [{ date: '2026-02-19', sessions: 5 }],
    };

    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockResponse, error: null });

    const result = await analyticsService.getAIChatSessionMetrics('30_days');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_ai_chat_session_depth', {
      timeframe: '30_days',
    });
    expect(result).toEqual(mockResponse);
  });

  it('getRetentionMetrics calls admin_retention with no params', async () => {
    const mockData = {
      day1Retention: 60,
      day7Retention: 40,
      day30Retention: 20,
      avgTimeToFirstCook: 2.5,
    };
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getRetentionMetrics();

    expect(supabase.rpc).toHaveBeenCalledWith('admin_retention');
    expect(result).toEqual(mockData);
  });

  it('getDailySignups calls admin_daily_signups with timeframe', async () => {
    const mockData = [
      { date: '2026-03-08', signups: 5, onboarded: 3 },
      { date: '2026-03-09', signups: 8, onboarded: 6 },
    ];
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getDailySignups('7_days');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_daily_signups', { timeframe: '7_days' });
    expect(result).toEqual(mockData);
  });

  it('getDailyActiveUsers calls admin_daily_active_users with timeframe', async () => {
    const mockData = [
      { date: '2026-03-08', users: 12 },
      { date: '2026-03-09', users: 15 },
    ];
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getDailyActiveUsers('30_days');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_daily_active_users', { timeframe: '30_days' });
    expect(result).toEqual(mockData);
  });

  it('getDailyAIUsers calls admin_daily_ai_users with timeframe', async () => {
    const mockData = [
      { date: '2026-03-08', users: 4 },
      { date: '2026-03-09', users: 7 },
    ];
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getDailyAIUsers('7_days');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_daily_ai_users', { timeframe: '7_days' });
    expect(result).toEqual(mockData);
  });

  it('getContentSourceSplit calls admin_content_source_split with timeframe', async () => {
    const mockData = { catalog: 45, userGenerated: 12 };
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.getContentSourceSplit('all_time');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_content_source_split', { timeframe: 'all_time' });
    expect(result).toEqual(mockData);
  });

  it('getDailySignups returns empty array when data is null', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });

    const result = await analyticsService.getDailySignups('7_days');

    expect(result).toEqual([]);
  });

  it('throws when RPC returns error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Admin access required', code: 'P0001' },
    });

    await expect(analyticsService.getOverviewMetrics()).rejects.toEqual({
      message: 'Admin access required',
      code: 'P0001',
    });
  });

  it('getTopViewedRecipes returns empty array when data is null', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });

    const result = await analyticsService.getTopViewedRecipes('7_days');

    expect(result).toEqual([]);
  });
});

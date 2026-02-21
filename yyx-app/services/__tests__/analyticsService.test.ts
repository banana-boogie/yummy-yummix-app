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

  it('getAIMetrics forwards timeframe to admin_analytics action', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: {
        aiAdoptionRate: 35,
        totalChatSessions: 100,
        totalVoiceSessions: 20,
        aiUserCount: 45,
        returnAIUsers: 12,
      },
      error: null,
    });

    await analyticsService.getAIMetrics('30_days');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_analytics', {
      action: 'ai',
      timeframe: '30_days',
      limit_count: undefined,
    });
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
      topUsers: [{ userId: 'abc', sessions: 12, totalMessages: 84, avgMessages: 7.0 }],
      dailySessions: [{ date: '2026-02-19', sessions: 5 }],
    };

    (supabase.rpc as jest.Mock).mockResolvedValue({ data: mockResponse, error: null });

    const result = await analyticsService.getAIChatSessionMetrics('30_days');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_ai_chat_session_depth', {
      timeframe: '30_days',
    });
    expect(result).toEqual(mockResponse);
  });

  it('getRecipeGenerationMetrics routes to recipe_generation action', async () => {
    const payload = {
      totalGenerated: 12,
      totalFailed: 3,
      successRate: 75,
      avgDurationMs: 2100,
    };

    (supabase.rpc as jest.Mock).mockResolvedValue({ data: payload, error: null });

    const result = await analyticsService.getRecipeGenerationMetrics('today');

    expect(supabase.rpc).toHaveBeenCalledWith('admin_analytics', {
      action: 'recipe_generation',
      timeframe: 'today',
      limit_count: undefined,
    });
    expect(result).toEqual(payload);
  });
});

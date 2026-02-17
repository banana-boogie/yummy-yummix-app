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

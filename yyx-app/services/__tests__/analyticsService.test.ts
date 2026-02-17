/**
 * analyticsService Tests
 *
 * Tests for admin analytics service covering:
 * - Successful data return from RPC
 * - Error handling when RPC fails
 * - List methods returning empty array when data is null
 *
 * FOR AI AGENTS:
 * - Uses the global Supabase mock from jest.setup.js
 * - Access via getMockSupabaseClient().rpc
 */

import { getMockSupabaseClient } from '@/test/mocks/supabase';
import { analyticsService } from '../analyticsService';

describe('analyticsService', () => {
  const mockClient = getMockSupabaseClient();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // SUCCESSFUL DATA RETURN
  // ============================================================

  describe('successful data return', () => {
    it('getOverviewMetrics returns data from RPC', async () => {
      const mockData = {
        dau: 100,
        wau: 500,
        mau: 2000,
        totalSignups: 5000,
        onboardingRate: 0.85,
      };
      mockClient.rpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await analyticsService.getOverviewMetrics();

      expect(result).toEqual(mockData);
      expect(mockClient.rpc).toHaveBeenCalledWith('admin_analytics', {
        action: 'overview',
        timeframe: undefined,
        limit_count: undefined,
      });
    });

    it('getFunnelMetrics passes timeframe', async () => {
      const mockData = {
        totalViews: 1000,
        totalStarts: 200,
        totalCompletes: 100,
        viewToStartRate: 0.2,
        startToCompleteRate: 0.5,
        overallConversionRate: 0.1,
      };
      mockClient.rpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await analyticsService.getFunnelMetrics('7_days');

      expect(result).toEqual(mockData);
      expect(mockClient.rpc).toHaveBeenCalledWith('admin_analytics', {
        action: 'funnel',
        timeframe: '7_days',
        limit_count: undefined,
      });
    });

    it('getRetentionMetrics returns data from RPC', async () => {
      const mockData = {
        day1Retention: 0.6,
        day7Retention: 0.3,
        day30Retention: 0.15,
        avgTimeToFirstCook: 24,
        weeklyCookRate: 0.4,
      };
      mockClient.rpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await analyticsService.getRetentionMetrics();

      expect(result).toEqual(mockData);
      expect(mockClient.rpc).toHaveBeenCalledWith('admin_analytics', {
        action: 'retention',
        timeframe: undefined,
        limit_count: undefined,
      });
    });

    it('getTopCookedRecipes returns data and passes params', async () => {
      const mockData = [
        { recipeId: 'recipe-1', recipeName: 'Soup', count: 12 },
      ];
      mockClient.rpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await analyticsService.getTopCookedRecipes('30_days', 3);

      expect(result).toEqual(mockData);
      expect(mockClient.rpc).toHaveBeenCalledWith('admin_analytics', {
        action: 'top_cooked_recipes',
        timeframe: '30_days',
        limit_count: 3,
      });
    });

    it('getTopSearches returns data and passes params', async () => {
      const mockData = [
        { query: 'pasta', count: 20 },
      ];
      mockClient.rpc.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await analyticsService.getTopSearches('today', 7);

      expect(result).toEqual(mockData);
      expect(mockClient.rpc).toHaveBeenCalledWith('admin_analytics', {
        action: 'top_searches',
        timeframe: 'today',
        limit_count: 7,
      });
    });
  });

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  describe('error handling', () => {
    it('throws when RPC returns error', async () => {
      const rpcError = { message: 'Function not found', code: '42883' };
      mockClient.rpc.mockResolvedValueOnce({ data: null, error: rpcError });

      await expect(analyticsService.getOverviewMetrics()).rejects.toEqual(rpcError);
    });

    it('throws on RPC error for list methods', async () => {
      const rpcError = { message: 'Timeout', code: '57014' };
      mockClient.rpc.mockResolvedValueOnce({ data: null, error: rpcError });

      await expect(analyticsService.getTopViewedRecipes('30_days')).rejects.toEqual(rpcError);
    });

    it('throws on RPC error for funnel metrics', async () => {
      const rpcError = { message: 'Funnel failed', code: '50000' };
      mockClient.rpc.mockResolvedValueOnce({ data: null, error: rpcError });

      await expect(analyticsService.getFunnelMetrics('7_days')).rejects.toEqual(rpcError);
    });

    it('throws on RPC error for retention metrics', async () => {
      const rpcError = { message: 'Retention failed', code: '50000' };
      mockClient.rpc.mockResolvedValueOnce({ data: null, error: rpcError });

      await expect(analyticsService.getRetentionMetrics()).rejects.toEqual(rpcError);
    });

    it('throws on RPC error for top cooked and top searches', async () => {
      const firstError = { message: 'Top cooked failed', code: '50000' };
      const secondError = { message: 'Top searches failed', code: '50000' };

      mockClient.rpc.mockResolvedValueOnce({ data: null, error: firstError });
      await expect(analyticsService.getTopCookedRecipes('7_days')).rejects.toEqual(firstError);

      mockClient.rpc.mockResolvedValueOnce({ data: null, error: secondError });
      await expect(analyticsService.getTopSearches('7_days')).rejects.toEqual(secondError);
    });
  });

  // ============================================================
  // NULL DATA FALLBACK FOR LIST METHODS
  // ============================================================

  describe('null data fallback', () => {
    it('getTopViewedRecipes returns empty array when data is null', async () => {
      mockClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await analyticsService.getTopViewedRecipes('7_days');

      expect(result).toEqual([]);
    });

    it('getTopCookedRecipes returns empty array when data is null', async () => {
      mockClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await analyticsService.getTopCookedRecipes('30_days');

      expect(result).toEqual([]);
    });

    it('getTopSearches returns empty array when data is null', async () => {
      mockClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await analyticsService.getTopSearches('today');

      expect(result).toEqual([]);
    });

    it('getTopViewedRecipes passes limit parameter', async () => {
      mockClient.rpc.mockResolvedValueOnce({ data: [], error: null });

      await analyticsService.getTopViewedRecipes('7_days', 5);

      expect(mockClient.rpc).toHaveBeenCalledWith('admin_analytics', {
        action: 'top_viewed_recipes',
        timeframe: '7_days',
        limit_count: 5,
      });
    });
  });
});

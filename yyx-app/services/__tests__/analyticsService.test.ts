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

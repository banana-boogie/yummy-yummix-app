import { fetchBudgetUsage } from '../budgetService';

// Mock supabase
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();

const createChain = () => ({
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
});

jest.mock('@/lib/supabase', () => {
  const chainMethods = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  };

  return {
    supabase: {
      from: jest.fn(() => chainMethods),
    },
  };
});

jest.mock('@/services/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

// Get reference to mock
import { supabase } from '@/lib/supabase';
const mockFrom = supabase.from as jest.Mock;

describe('fetchBudgetUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Call sequence:
    // 1. from('user_profiles').select().eq().single() -> profile
    // 2. from('ai_membership_tiers').select().eq().maybeSingle() -> tier limits
    // 3. from('ai_budget_usage').select().eq().eq().maybeSingle() -> usage

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain: any = {
        select: jest.fn().mockReturnValue(undefined),
        eq: jest.fn().mockReturnValue(undefined),
        single: jest.fn(),
        maybeSingle: jest.fn(),
      };

      // Each call to from() returns a chain
      // We need to track which call we're on
      if (callCount === 1) {
        // user_profiles
        chain.select = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { membership_tier: 'free' },
              error: null,
            }),
          }),
        });
      } else if (callCount === 2) {
        // ai_membership_tiers
        chain.select = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { monthly_text_budget_usd: 0.10 },
              error: null,
            }),
          }),
        });
      } else if (callCount === 3) {
        // ai_budget_usage
        chain.select = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { total_cost_usd: 0.045, request_count: 12 },
                error: null,
              }),
            }),
          }),
        });
      }

      return chain;
    });
  });

  it('returns usage data with correct percentage', async () => {
    const result = await fetchBudgetUsage('user-123');

    expect(result.usagePercent).toBe(45);
    expect(result.totalCostUsd).toBe(0.045);
    expect(result.budgetUsd).toBe(0.10);
    expect(result.requestCount).toBe(12);
    expect(result.tier).toBe('free');
  });

  it('returns 0% when no usage exists', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain: any = {};

      if (callCount === 1) {
        chain.select = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { membership_tier: 'free' },
              error: null,
            }),
          }),
        });
      } else if (callCount === 2) {
        chain.select = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { monthly_text_budget_usd: 0.10 },
              error: null,
            }),
          }),
        });
      } else if (callCount === 3) {
        // No usage row exists
        chain.select = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        });
      }

      return chain;
    });

    const result = await fetchBudgetUsage('user-123');

    expect(result.usagePercent).toBe(0);
    expect(result.totalCostUsd).toBe(0);
    expect(result.requestCount).toBe(0);
  });

  it('caps percentage at 100', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain: any = {};

      if (callCount === 1) {
        chain.select = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { membership_tier: 'free' },
              error: null,
            }),
          }),
        });
      } else if (callCount === 2) {
        chain.select = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { monthly_text_budget_usd: 0.10 },
              error: null,
            }),
          }),
        });
      } else if (callCount === 3) {
        // Over budget
        chain.select = jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { total_cost_usd: 0.15, request_count: 50 },
                error: null,
              }),
            }),
          }),
        });
      }

      return chain;
    });

    const result = await fetchBudgetUsage('user-123');

    expect(result.usagePercent).toBe(100);
  });
});

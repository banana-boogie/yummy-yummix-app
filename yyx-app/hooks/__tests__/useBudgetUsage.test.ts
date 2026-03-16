/**
 * useBudgetUsage Hook Tests
 *
 * Tests for AI budget usage fetching covering:
 * - Initial loading state
 * - Successful data fetching
 * - Error handling
 * - Refetch behavior
 * - No-user early exit
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useBudgetUsage } from '../useBudgetUsage';
import { userFactory } from '@/test/factories';
import type { BudgetUsage } from '@/services/budgetService';

// ============================================================
// MOCKS
// ============================================================

const mockUser = userFactory.createSupabaseUser();
let mockUserValue: typeof mockUser | null = mockUser;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUserValue,
  }),
}));

const mockFetchBudgetUsage = jest.fn();

jest.mock('@/services/budgetService', () => ({
  fetchBudgetUsage: (...args: any[]) => mockFetchBudgetUsage(...args),
}));

jest.mock('@/services/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================
// FACTORY
// ============================================================

function createBudgetUsage(overrides?: Partial<BudgetUsage>): BudgetUsage {
  return {
    usagePercent: 42,
    totalCostUsd: 0.042,
    budgetUsd: 0.10,
    requestCount: 7,
    tier: 'free',
    ...overrides,
  };
}

// ============================================================
// TESTS
// ============================================================

describe('useBudgetUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserValue = mockUser;
    mockFetchBudgetUsage.mockResolvedValue(createBudgetUsage());
  });

  // ============================================================
  // LOADING STATE
  // ============================================================

  describe('loading state', () => {
    it('returns loading=true initially while fetch is in progress', () => {
      // Arrange - make the fetch hang so we can observe loading
      mockFetchBudgetUsage.mockImplementation(
        () => new Promise(() => {})
      );

      // Act
      const { result } = renderHook(() => useBudgetUsage());

      // Assert
      expect(result.current.loading).toBe(true);
      expect(result.current.usage).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // ============================================================
  // SUCCESSFUL FETCH
  // ============================================================

  describe('successful fetch', () => {
    it('returns usage data after fetch completes', async () => {
      // Arrange
      const mockUsage = createBudgetUsage({ usagePercent: 75, requestCount: 15 });
      mockFetchBudgetUsage.mockResolvedValue(mockUsage);

      // Act
      const { result } = renderHook(() => useBudgetUsage());

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.usage).toEqual(mockUsage);
      expect(result.current.error).toBeNull();
      expect(mockFetchBudgetUsage).toHaveBeenCalledWith(mockUser.id);
    });

    it('sets loading=false after fetch completes', async () => {
      // Act
      const { result } = renderHook(() => useBudgetUsage());

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.loading).toBe(false);
    });
  });

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  describe('error handling', () => {
    it('returns error on fetch failure with usage remaining null', async () => {
      // Arrange
      mockFetchBudgetUsage.mockRejectedValue(new Error('Network error'));

      // Act
      const { result } = renderHook(() => useBudgetUsage());

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load usage');
      expect(result.current.usage).toBeNull();
    });
  });

  // ============================================================
  // REFETCH
  // ============================================================

  describe('refetch', () => {
    it('triggers a new fetch when refetch is called', async () => {
      // Arrange
      const { result } = renderHook(() => useBudgetUsage());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetchBudgetUsage).toHaveBeenCalledTimes(1);

      // Act
      const updatedUsage = createBudgetUsage({ usagePercent: 90, requestCount: 20 });
      mockFetchBudgetUsage.mockResolvedValue(updatedUsage);

      act(() => {
        result.current.refetch();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.usage).toEqual(updatedUsage);
      });

      expect(mockFetchBudgetUsage).toHaveBeenCalledTimes(2);
    });

    it('resets loading to true during refetch', async () => {
      // Arrange
      const { result } = renderHook(() => useBudgetUsage());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - make the second fetch hang so we can observe loading
      mockFetchBudgetUsage.mockImplementation(
        () => new Promise(() => {})
      );

      act(() => {
        result.current.refetch();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });
    });
  });

  // ============================================================
  // NO USER
  // ============================================================

  describe('when user is not logged in', () => {
    it('sets loading=false without fetching', async () => {
      // Arrange
      mockUserValue = null;

      // Act
      const { result } = renderHook(() => useBudgetUsage());

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.usage).toBeNull();
      expect(mockFetchBudgetUsage).not.toHaveBeenCalled();
    });
  });
});

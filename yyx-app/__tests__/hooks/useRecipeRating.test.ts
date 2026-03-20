import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRecipeRating } from '@/hooks/useRecipeRating';
import { ratingService } from '@/services/ratingService';

// Mock dependencies
jest.mock('@/services/ratingService', () => ({
  ratingService: {
    getUserRating: jest.fn(),
    getRatingDistribution: jest.fn(),
    submitRating: jest.fn(),
    submitFeedback: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useRecipeRating', () => {
  const mockRecipeId = 'recipe-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch user rating on mount', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(4);
    (ratingService.getRatingDistribution as jest.Mock).mockResolvedValue({
      distribution: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 3 },
      total: 6,
    });

    const { result } = renderHook(() => useRecipeRating(mockRecipeId), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoadingRating).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    expect(result.current.userRating).toBe(4);
    expect(ratingService.getUserRating).toHaveBeenCalledWith(mockRecipeId);
  });

  it('should fetch rating distribution', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(null);
    (ratingService.getRatingDistribution as jest.Mock).mockResolvedValue({
      distribution: { 1: 1, 2: 0, 3: 2, 4: 3, 5: 5 },
      total: 11,
    });

    const { result } = renderHook(() => useRecipeRating(mockRecipeId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingDistribution).toBe(false);
    });

    expect(result.current.ratingDistribution).toEqual({ 1: 1, 2: 0, 3: 2, 4: 3, 5: 5 });
    expect(result.current.totalRatings).toBe(11);
  });

  it('should submit rating via mutation', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(null);
    (ratingService.getRatingDistribution as jest.Mock).mockResolvedValue({
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      total: 0,
    });
    (ratingService.submitRating as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRecipeRating(mockRecipeId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    await act(async () => {
      await result.current.submitRatingAsync(5);
    });

    expect(ratingService.submitRating).toHaveBeenCalledWith(mockRecipeId, 5);
  });

  it('should submit feedback via mutation', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(null);
    (ratingService.getRatingDistribution as jest.Mock).mockResolvedValue({
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      total: 0,
    });
    (ratingService.submitFeedback as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRecipeRating(mockRecipeId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    await act(async () => {
      await result.current.submitFeedbackAsync('Great recipe!');
    });

    expect(ratingService.submitFeedback).toHaveBeenCalledWith(mockRecipeId, 'Great recipe!');
  });

  it('should handle submit rating error', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(null);
    (ratingService.getRatingDistribution as jest.Mock).mockResolvedValue({
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      total: 0,
    });
    (ratingService.submitRating as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useRecipeRating(mockRecipeId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    await act(async () => {
      try {
        await result.current.submitRatingAsync(5);
      } catch {
        // Expected error
      }
    });

    expect(result.current.ratingError).toBeTruthy();
  });

  it('should return null userRating when no rating exists', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(null);
    (ratingService.getRatingDistribution as jest.Mock).mockResolvedValue({
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      total: 0,
    });

    const { result } = renderHook(() => useRecipeRating(mockRecipeId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    expect(result.current.userRating).toBeNull();
  });
});

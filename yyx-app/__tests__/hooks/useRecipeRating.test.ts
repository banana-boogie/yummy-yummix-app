import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRecipeRating } from '@/hooks/useRecipeRating';
import { ratingService } from '@/services/ratingService';

// Mock the ratingService
jest.mock('@/services/ratingService', () => ({
  ratingService: {
    submitRating: jest.fn(),
    submitFeedback: jest.fn(),
    getUserRating: jest.fn(),
  },
}));

// Mock the auth context
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

describe('useRecipeRating', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should fetch user rating on mount', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(4);

    const { result } = renderHook(() => useRecipeRating('recipe-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.userRating).toBe(4);
    });

    expect(ratingService.getUserRating).toHaveBeenCalledWith('recipe-123');
  });

  it('should return null when no rating exists', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useRecipeRating('recipe-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.userRating).toBeNull();
    });
  });

  it('should submit a rating successfully', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(null);
    (ratingService.submitRating as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRecipeRating('recipe-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    result.current.submitRating(5);

    await waitFor(() => {
      expect(result.current.isSubmittingRating).toBe(false);
    });

    expect(ratingService.submitRating).toHaveBeenCalledWith('recipe-123', 5);
  });

  it('should submit feedback successfully', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(4);
    (ratingService.submitFeedback as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRecipeRating('recipe-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    result.current.submitFeedback('Great recipe!');

    await waitFor(() => {
      expect(result.current.isSubmittingFeedback).toBe(false);
    });

    expect(ratingService.submitFeedback).toHaveBeenCalledWith('recipe-123', 'Great recipe!');
  });

  it('should handle rating submission error', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(null);
    (ratingService.submitRating as jest.Mock).mockRejectedValue(new Error('Failed to submit'));

    const { result } = renderHook(() => useRecipeRating('recipe-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    result.current.submitRating(5);

    await waitFor(() => {
      expect(result.current.ratingError).toBeTruthy();
    });

    expect(result.current.ratingError?.message).toBe('Failed to submit');
  });

  it('should handle feedback submission error', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(4);
    (ratingService.submitFeedback as jest.Mock).mockRejectedValue(
      new Error('Feedback too long')
    );

    const { result } = renderHook(() => useRecipeRating('recipe-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    result.current.submitFeedback('x'.repeat(2001));

    await waitFor(() => {
      expect(result.current.feedbackError).toBeTruthy();
    });

    expect(result.current.feedbackError?.message).toBe('Feedback too long');
  });

  it('should optimistically update rating', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(3);
    (ratingService.submitRating as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRecipeRating('recipe-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.userRating).toBe(3);
    });

    // Submit new rating
    result.current.submitRating(5);

    // Rating should be updated immediately (optimistic update)
    await waitFor(() => {
      expect(result.current.isSubmittingRating).toBe(false);
    });

    expect(ratingService.submitRating).toHaveBeenCalledWith('recipe-123', 5);
  });

  it('should invalidate queries after successful rating submission', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(null);
    (ratingService.submitRating as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRecipeRating('recipe-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    result.current.submitRating(4);

    await waitFor(() => {
      expect(result.current.isSubmittingRating).toBe(false);
    });

    // Verify that queries were invalidated
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('should invalidate queries after successful feedback submission', async () => {
    (ratingService.getUserRating as jest.Mock).mockResolvedValue(4);
    (ratingService.submitFeedback as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRecipeRating('recipe-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingRating).toBe(false);
    });

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    result.current.submitFeedback('Loved it!');

    await waitFor(() => {
      expect(result.current.isSubmittingFeedback).toBe(false);
    });

    // Verify that queries were invalidated
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

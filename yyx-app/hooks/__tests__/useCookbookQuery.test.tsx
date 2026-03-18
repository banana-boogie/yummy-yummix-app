import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils/render';
import {
  useUserCookbooksQuery,
  useSharedCookbookQuery,
  useDeleteCookbook,
  useAddRecipeToCookbook,
  useRemoveRecipeFromCookbook,
  cookbookKeys,
} from '../useCookbookQuery';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: jest.fn(),
}));

jest.mock('@/services/cookbookService', () => ({
  cookbookService: {
    ensureDefaultCookbook: jest.fn(),
    getUserCookbooks: jest.fn(),
    getCookbookByShareToken: jest.fn(),
    deleteCookbook: jest.fn(),
    addRecipeToCookbook: jest.fn(),
    removeRecipeFromCookbook: jest.fn(),
  },
}));

const { useAuth } = require('@/contexts/AuthContext');
const { useLanguage } = require('@/contexts/LanguageContext');
const { cookbookService } = require('@/services/cookbookService');

describe('useCookbookQuery hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );

  it('ensures default cookbook and returns user cookbooks', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' } });
    useLanguage.mockReturnValue({ language: 'en' });

    const cookbooks = [
      {
        id: 'cb-1',
        userId: 'user-1',
        name: 'Family',
        description: 'Family favorites',
        isPublic: false,
        isDefault: false,
        shareEnabled: false,
        shareToken: 'token-1',
        recipeCount: 2,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    cookbookService.ensureDefaultCookbook.mockResolvedValue(cookbooks[0]);
    cookbookService.getUserCookbooks.mockResolvedValue(cookbooks);

    const { result } = renderHook(() => useUserCookbooksQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(cookbookService.ensureDefaultCookbook).toHaveBeenCalledWith('user-1');
    expect(cookbookService.getUserCookbooks).toHaveBeenCalledWith('user-1');
    expect(result.current.data).toEqual(cookbooks);
  });

  it('fetches shared cookbook by token', async () => {
    useLanguage.mockReturnValue({ language: 'en' });

    const sharedCookbook = {
      id: 'cb-2',
      userId: 'user-2',
      name: 'Shared',
      description: undefined,
      isPublic: false,
      isDefault: false,
      shareEnabled: true,
      shareToken: 'token-2',
      recipeCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      recipes: [],
    };

    cookbookService.getCookbookByShareToken.mockResolvedValue(sharedCookbook);

    const { result } = renderHook(
      () => useSharedCookbookQuery('token-2'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(cookbookService.getCookbookByShareToken).toHaveBeenCalledWith('token-2');
    expect(result.current.data).toEqual(sharedCookbook);
  });

  // ==========================================================================
  // Mutation Hooks
  // ==========================================================================

  describe('useDeleteCookbook', () => {
    it('optimistically removes cookbook from cache on delete', async () => {
      useAuth.mockReturnValue({ user: { id: 'user-1' } });
      useLanguage.mockReturnValue({ language: 'en' });
      cookbookService.deleteCookbook.mockResolvedValue(undefined);

      const queryClient = createTestQueryClient();

      // Pre-populate the cache with cookbooks
      const cookbooks = [
        { id: 'cb-1', userId: 'user-1', name: 'Family', recipeCount: 2 },
        { id: 'cb-2', userId: 'user-1', name: 'Italian', recipeCount: 5 },
      ];
      queryClient.setQueryData(cookbookKeys.list('user-1', 'en'), cookbooks);

      const hookWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useDeleteCookbook(), {
        wrapper: hookWrapper,
      });

      // Trigger the mutation
      result.current.mutate('cb-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(cookbookService.deleteCookbook).toHaveBeenCalledWith('cb-1');
    });

    it('calls service with cookbook id and handles error', async () => {
      useAuth.mockReturnValue({ user: { id: 'user-1' } });
      useLanguage.mockReturnValue({ language: 'en' });
      cookbookService.deleteCookbook.mockRejectedValue(new Error('Network error'));

      const queryClient = createTestQueryClient();

      const hookWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useDeleteCookbook(), {
        wrapper: hookWrapper,
      });

      result.current.mutate('cb-1');

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(cookbookService.deleteCookbook).toHaveBeenCalledWith('cb-1');
    });
  });

  describe('useAddRecipeToCookbook', () => {
    it('calls service and invalidates queries on success', async () => {
      useAuth.mockReturnValue({ user: { id: 'user-1' } });
      useLanguage.mockReturnValue({ language: 'en' });
      cookbookService.addRecipeToCookbook.mockResolvedValue(undefined);

      const queryClient = createTestQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const hookWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAddRecipeToCookbook(), {
        wrapper: hookWrapper,
      });

      const input = { cookbookId: 'cb-1', recipeId: 'recipe-1', notes: 'test' };
      result.current.mutate(input);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(cookbookService.addRecipeToCookbook).toHaveBeenCalledWith(input);

      // Should invalidate list and detail queries on settle
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: cookbookKeys.list('user-1', 'en'),
        })
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: cookbookKeys.detail('cb-1', 'en'),
        })
      );
    });

    it('handles add recipe error gracefully', async () => {
      useAuth.mockReturnValue({ user: { id: 'user-1' } });
      useLanguage.mockReturnValue({ language: 'en' });
      cookbookService.addRecipeToCookbook.mockRejectedValue(new Error('Failed'));

      const queryClient = createTestQueryClient();

      const hookWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useAddRecipeToCookbook(), {
        wrapper: hookWrapper,
      });

      result.current.mutate({ cookbookId: 'cb-1', recipeId: 'recipe-1' });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Failed');
    });
  });

  describe('useRemoveRecipeFromCookbook', () => {
    it('calls service with cookbookId and recipeId', async () => {
      useAuth.mockReturnValue({ user: { id: 'user-1' } });
      useLanguage.mockReturnValue({ language: 'en' });
      cookbookService.removeRecipeFromCookbook.mockResolvedValue(undefined);

      const queryClient = createTestQueryClient();

      const hookWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useRemoveRecipeFromCookbook(), {
        wrapper: hookWrapper,
      });

      result.current.mutate({ cookbookId: 'cb-1', recipeId: 'recipe-1' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(cookbookService.removeRecipeFromCookbook).toHaveBeenCalledWith('cb-1', 'recipe-1');
    });

    it('handles remove recipe error gracefully', async () => {
      useAuth.mockReturnValue({ user: { id: 'user-1' } });
      useLanguage.mockReturnValue({ language: 'en' });
      cookbookService.removeRecipeFromCookbook.mockRejectedValue(new Error('Removal failed'));

      const queryClient = createTestQueryClient();

      const hookWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useRemoveRecipeFromCookbook(), {
        wrapper: hookWrapper,
      });

      result.current.mutate({ cookbookId: 'cb-1', recipeId: 'recipe-1' });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Removal failed');
    });

    it('invalidates list query on successful removal', async () => {
      useAuth.mockReturnValue({ user: { id: 'user-1' } });
      useLanguage.mockReturnValue({ language: 'en' });
      cookbookService.removeRecipeFromCookbook.mockResolvedValue(undefined);

      const queryClient = createTestQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const hookWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useRemoveRecipeFromCookbook(), {
        wrapper: hookWrapper,
      });

      result.current.mutate({ cookbookId: 'cb-1', recipeId: 'recipe-1' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: cookbookKeys.list('user-1', 'en'),
        })
      );
    });
  });
});

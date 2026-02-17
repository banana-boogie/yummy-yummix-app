/**
 * useCustomRecipe Hook Tests
 *
 * Tests for the custom recipe loading hooks.
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCustomRecipe,
  useCustomRecipeQuery,
  customRecipeKeys,
} from '../useCustomRecipe';
import { customRecipeService } from '@/services/customRecipeService';
import { createMockGeneratedRecipe } from '@/test/mocks/chat';

// Mock the customRecipeService
jest.mock('@/services/customRecipeService');

const mockLoad = customRecipeService.load as jest.Mock;

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
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

describe('customRecipeKeys', () => {
  it('creates correct all key', () => {
    expect(customRecipeKeys.all).toEqual(['customRecipes']);
  });

  it('creates correct detail key', () => {
    expect(customRecipeKeys.detail('recipe-123')).toEqual([
      'customRecipes',
      'detail',
      'recipe-123',
    ]);
  });

  it('creates correct list key', () => {
    expect(customRecipeKeys.list()).toEqual(['customRecipes', 'list']);
  });
});

describe('useCustomRecipeQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is disabled when no id is provided', () => {
    const { result } = renderHook(() => useCustomRecipeQuery(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('returns loading initially then success', async () => {
    const mockRecipe = createMockGeneratedRecipe({
      suggestedName: 'Test Recipe',
      totalTime: 45,
      difficulty: 'medium',
    });

    mockLoad.mockResolvedValue({
      id: 'recipe-123',
      name: 'My Custom Name',
      recipe: mockRecipe,
      source: 'ai_generated',
      createdAt: '2024-01-15T12:00:00Z',
    });

    const { result } = renderHook(() => useCustomRecipeQuery('recipe-123'), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.id).toBe('recipe-123');
    expect(result.current.data?.name).toBe('My Custom Name');
  });

  it('returns error on failure', async () => {
    mockLoad.mockRejectedValue(new Error('Failed to load recipe'));

    const { result } = renderHook(() => useCustomRecipeQuery('recipe-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('uses correct query key', async () => {
    const mockRecipe = createMockGeneratedRecipe();
    mockLoad.mockResolvedValue({
      id: 'recipe-123',
      name: 'Test',
      recipe: mockRecipe,
      source: 'ai_generated',
      createdAt: '2024-01-15T12:00:00Z',
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useCustomRecipeQuery('recipe-123'), { wrapper });

    await waitFor(() => {
      const data = queryClient.getQueryData(customRecipeKeys.detail('recipe-123'));
      expect(data).toBeDefined();
    });
  });
});

describe('useCustomRecipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null recipe when id is empty', () => {
    const { result } = renderHook(() => useCustomRecipe(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.recipe).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('returns recipe on success', async () => {
    const mockRecipe = createMockGeneratedRecipe({
      totalTime: 60,
      difficulty: 'hard',
      portions: 8,
    });

    mockLoad.mockResolvedValue({
      id: 'recipe-789',
      name: 'Complex Recipe',
      recipe: mockRecipe,
      source: 'ai_generated',
      createdAt: '2024-01-15T12:00:00Z',
    });

    const { result } = renderHook(() => useCustomRecipe('recipe-789'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.recipe?.id).toBe('recipe-789');
    expect(result.current.recipe?.name).toBe('Complex Recipe');
    expect(result.current.recipe?.totalTime).toBe(60);
  });

  it('returns error message on failure', async () => {
    mockLoad.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCustomRecipe('recipe-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.recipe).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('matches CustomRecipeResult interface', async () => {
    const mockRecipe = createMockGeneratedRecipe();
    mockLoad.mockResolvedValue({
      id: 'recipe-123',
      name: 'Test',
      recipe: mockRecipe,
      source: 'ai_generated',
      createdAt: '2024-01-15T12:00:00Z',
    });

    const { result } = renderHook(() => useCustomRecipe('recipe-123'), {
      wrapper: createWrapper(),
    });

    // Check that the return type matches CustomRecipeResult interface
    expect('recipe' in result.current).toBe(true);
    expect('loading' in result.current).toBe(true);
    expect('error' in result.current).toBe(true);
  });
});

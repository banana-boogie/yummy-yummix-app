import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils/render';
import { useUserCookbooksQuery, useSharedCookbookQuery } from '../useCookbookQuery';

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
});

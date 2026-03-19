import React from 'react';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils/render';
import { FavoriteHeart } from '../FavoriteHeart';

const mockAddMutateAsync = jest.fn();
const mockRemoveMutateAsync = jest.fn();

jest.mock('@/hooks/useCookbookQuery', () => ({
  useUserCookbooksQuery: jest.fn(),
  useAddRecipeToCookbook: () => ({
    mutateAsync: mockAddMutateAsync,
    isPending: false,
  }),
  useRemoveRecipeFromCookbook: () => ({
    mutateAsync: mockRemoveMutateAsync,
    isPending: false,
  }),
  useCookbooksContainingRecipe: jest.fn(),
}));

const {
  useUserCookbooksQuery,
  useCookbooksContainingRecipe,
} = require('@/hooks/useCookbookQuery');

const defaultCookbook = {
  id: 'favorites-1',
  userId: 'user-1',
  name: 'Favorites',
  isPublic: false,
  isDefault: true,
  shareEnabled: false,
  shareToken: '',
  recipeCount: 3,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('FavoriteHeart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUserCookbooksQuery.mockReturnValue({ data: [defaultCookbook] });
    useCookbooksContainingRecipe.mockReturnValue({ data: [] });
  });

  it('renders unfilled heart when recipe is not favorited', () => {
    renderWithProviders(<FavoriteHeart recipeId="recipe-1" />);

    const button = screen.getByLabelText('Add to favorites');
    expect(button).toBeTruthy();
  });

  it('renders filled heart when recipe is in favorites', () => {
    useCookbooksContainingRecipe.mockReturnValue({
      data: [defaultCookbook],
    });

    renderWithProviders(<FavoriteHeart recipeId="recipe-1" />);

    const button = screen.getByLabelText('Remove from favorites');
    expect(button).toBeTruthy();
  });

  it('calls addRecipeToCookbook when tapping unfilled heart', async () => {
    mockAddMutateAsync.mockResolvedValue(undefined);

    renderWithProviders(<FavoriteHeart recipeId="recipe-1" />);

    fireEvent.press(screen.getByLabelText('Add to favorites'));

    await waitFor(() => {
      expect(mockAddMutateAsync).toHaveBeenCalledWith({
        cookbookId: 'favorites-1',
        recipeId: 'recipe-1',
      });
    });
  });

  it('calls removeRecipeFromCookbook when tapping filled heart', async () => {
    useCookbooksContainingRecipe.mockReturnValue({
      data: [defaultCookbook],
    });
    mockRemoveMutateAsync.mockResolvedValue(undefined);

    renderWithProviders(<FavoriteHeart recipeId="recipe-1" />);

    fireEvent.press(screen.getByLabelText('Remove from favorites'));

    await waitFor(() => {
      expect(mockRemoveMutateAsync).toHaveBeenCalledWith({
        cookbookId: 'favorites-1',
        recipeId: 'recipe-1',
      });
    });
  });

  it('renders nothing when user is not authenticated', () => {
    // Override auth mock for this test
    jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockReturnValue({
      user: null,
    });

    const { toJSON } = renderWithProviders(<FavoriteHeart recipeId="recipe-1" />);
    expect(toJSON()).toBeNull();

    // Restore
    jest.restoreAllMocks();
  });
});

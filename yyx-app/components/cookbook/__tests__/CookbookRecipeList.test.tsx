import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/utils/render';
import { CookbookRecipeList } from '../CookbookRecipeList';
import i18n from '@/i18n';

jest.mock('@/hooks/useCookbookQuery', () => ({
  useRemoveRecipeFromCookbook: () => ({ mutateAsync: jest.fn() }),
}));

describe('CookbookRecipeList', () => {
  it('renders empty state when no recipes', () => {
    renderWithProviders(
      <CookbookRecipeList recipes={[]} cookbookId="cb-1" isOwner={false} />
    );

    expect(screen.getByText(i18n.t('cookbooks.noRecipesYet'))).toBeTruthy();
    expect(screen.getByText(i18n.t('cookbooks.noRecipesDescription'))).toBeTruthy();
  });

  it('renders localized metadata', () => {
    const recipes = [
      {
        id: 'r1',
        name: 'Recipe A',
        description: 'Description A',
        imageUrl: 'https://example.com/a.jpg',
        prepTimeMinutes: 90,
        cookTimeMinutes: 30,
        servings: 2,
        difficulty: 'easy',
        notes: 'Note A',
        displayOrder: 0,
        addedAt: '2026-01-01T00:00:00Z',
        cookbookRecipeId: 'cr1',
      },
    ];

    renderWithProviders(
      <CookbookRecipeList recipes={recipes} cookbookId="cb-1" isOwner={true} />
    );

    expect(screen.getByText('Recipe A')).toBeTruthy();
    expect(screen.getByText('1h 30m')).toBeTruthy();
    expect(screen.getByText(i18n.t('recipes.common.difficulty.easy'))).toBeTruthy();
    expect(screen.getByText(`2 ${i18n.t('recipes.common.portions')}`)).toBeTruthy();
  });

  it('changes order when sorting by recent', () => {
    const recipes = [
      {
        id: 'r1',
        name: 'Recipe A',
        description: 'Description A',
        imageUrl: 'https://example.com/a.jpg',
        prepTimeMinutes: 10,
        cookTimeMinutes: 10,
        servings: 1,
        difficulty: 'easy',
        notes: undefined,
        displayOrder: 0,
        addedAt: '2026-01-01T00:00:00Z',
        cookbookRecipeId: 'cr1',
      },
      {
        id: 'r2',
        name: 'Recipe B',
        description: 'Description B',
        imageUrl: 'https://example.com/b.jpg',
        prepTimeMinutes: 20,
        cookTimeMinutes: 20,
        servings: 2,
        difficulty: 'medium',
        notes: undefined,
        displayOrder: 1,
        addedAt: '2026-02-01T00:00:00Z',
        cookbookRecipeId: 'cr2',
      },
    ];

    renderWithProviders(
      <CookbookRecipeList recipes={recipes} cookbookId="cb-1" isOwner={false} />
    );

    const initialOrder = screen.getAllByText(/Recipe/).map((node) => node.props.children);
    expect(initialOrder[0]).toBe('Recipe A');

    fireEvent.press(screen.getByText(i18n.t('cookbooks.sort.recent')));

    const recentOrder = screen.getAllByText(/Recipe/).map((node) => node.props.children);
    expect(recentOrder[0]).toBe('Recipe B');
  });
});

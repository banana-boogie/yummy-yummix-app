import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/utils/render';
import { CookbookRecipeList } from '../CookbookRecipeList';
import i18n from '@/i18n';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  useGlobalSearchParams: () => ({}),
  Link: 'Link',
  Stack: { Screen: 'Screen' },
  Tabs: { Screen: 'Screen' },
  Redirect: 'Redirect',
}));

jest.mock('@/hooks/useCookbookQuery', () => ({
  useRemoveRecipeFromCookbook: () => ({ mutateAsync: jest.fn() }),
}));

const mockRecipes = [
  {
    id: 'r1',
    name: 'Chocolate Cake',
    description: 'Delicious cake',
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
  {
    id: 'r2',
    name: 'Banana Bread',
    description: 'Moist bread',
    imageUrl: 'https://example.com/b.jpg',
    prepTimeMinutes: 20,
    cookTimeMinutes: 20,
    servings: 4,
    difficulty: 'medium',
    notes: undefined,
    displayOrder: 1,
    addedAt: '2026-02-01T00:00:00Z',
    cookbookRecipeId: 'cr2',
  },
];

describe('CookbookRecipeList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state with Browse Recipes button', () => {
    renderWithProviders(
      <CookbookRecipeList recipes={[]} cookbookId="cb-1" isOwner={false} />
    );

    expect(screen.getByText(i18n.t('cookbooks.noRecipesYet'))).toBeTruthy();
    expect(screen.getByText(i18n.t('cookbooks.noRecipesDescription'))).toBeTruthy();
    expect(screen.getByText(i18n.t('cookbooks.browseRecipes'))).toBeTruthy();
  });

  it('navigates to recipes tab when Browse Recipes is pressed', () => {
    renderWithProviders(
      <CookbookRecipeList recipes={[]} cookbookId="cb-1" isOwner={false} />
    );

    fireEvent.press(screen.getByText(i18n.t('cookbooks.browseRecipes')));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/recipes');
  });

  it('renders localized metadata', () => {
    renderWithProviders(
      <CookbookRecipeList recipes={[mockRecipes[0]]} cookbookId="cb-1" isOwner={true} />
    );

    expect(screen.getByText('Chocolate Cake')).toBeTruthy();
    expect(screen.getByText('1h 30m')).toBeTruthy();
    expect(screen.getByText(i18n.t('recipes.common.difficulty.easy'))).toBeTruthy();
    expect(screen.getByText(`2 ${i18n.t('recipes.common.portions')}`)).toBeTruthy();
  });

  it('filters recipes by search query', () => {
    renderWithProviders(
      <CookbookRecipeList recipes={mockRecipes} cookbookId="cb-1" isOwner={false} />
    );

    // Both recipes should be visible initially
    expect(screen.getByText('Chocolate Cake')).toBeTruthy();
    expect(screen.getByText('Banana Bread')).toBeTruthy();

    // Search for "chocolate"
    const searchInput = screen.getByPlaceholderText(i18n.t('cookbooks.searchRecipes'));
    fireEvent.changeText(searchInput, 'chocolate');

    // Only Chocolate Cake should be visible
    expect(screen.getByText('Chocolate Cake')).toBeTruthy();
    expect(screen.queryByText('Banana Bread')).toBeNull();
  });

  it('shows no results when search has no matches', () => {
    renderWithProviders(
      <CookbookRecipeList recipes={mockRecipes} cookbookId="cb-1" isOwner={false} />
    );

    const searchInput = screen.getByPlaceholderText(i18n.t('cookbooks.searchRecipes'));
    fireEvent.changeText(searchInput, 'nonexistent');

    expect(screen.getByText(i18n.t('recipes.common.noRecipesFound'))).toBeTruthy();
  });

  it('changes order when sorting by recent', () => {
    renderWithProviders(
      <CookbookRecipeList recipes={mockRecipes} cookbookId="cb-1" isOwner={false} />
    );

    const initialOrder = screen.getAllByText(/Cake|Bread/).map((node) => node.props.children);
    expect(initialOrder[0]).toBe('Chocolate Cake');

    fireEvent.press(screen.getByText(i18n.t('cookbooks.sort.recent')));

    const recentOrder = screen.getAllByText(/Cake|Bread/).map((node) => node.props.children);
    expect(recentOrder[0]).toBe('Banana Bread');
  });

  it('calls onRecipeRemoved callback after recipe removal', () => {
    const onRecipeRemoved = jest.fn();

    renderWithProviders(
      <CookbookRecipeList
        recipes={mockRecipes}
        cookbookId="cb-1"
        isOwner={true}
        onRecipeRemoved={onRecipeRemoved}
      />
    );

    // The remove buttons should be present for owners
    const removeButtons = screen.getAllByLabelText(i18n.t('cookbooks.a11y.removeFromCookbook'));
    expect(removeButtons.length).toBe(2);
  });
});

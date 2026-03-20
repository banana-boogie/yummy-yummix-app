import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { CookbookList } from '../CookbookList';
import { Cookbook } from '@/types/cookbook.types';
import i18n from '@/i18n';

// ============================================================================
// Factory helper
// ============================================================================

function createCookbook(overrides: Partial<Cookbook> = {}): Cookbook {
  return {
    id: 'cb-1',
    userId: 'user-1',
    name: 'Family',
    description: 'Family favorites',
    isPublic: false,
    isDefault: false,
    shareEnabled: false,
    shareToken: 'token-1',
    recipeCount: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('CookbookList', () => {
  const defaultProps = {
    cookbooks: [] as Cookbook[],
    onCookbookPress: jest.fn(),
    onCreatePress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    renderWithProviders(
      <CookbookList {...defaultProps} isLoading={true} />
    );

    expect(screen.getByText(i18n.t('common.loading'))).toBeTruthy();
  });

  it('renders create cookbook card when not loading', () => {
    renderWithProviders(
      <CookbookList {...defaultProps} cookbooks={[]} />
    );

    expect(
      screen.getByLabelText(i18n.t('cookbooks.a11y.createNewCookbook'))
    ).toBeTruthy();
    expect(screen.getByText(i18n.t('cookbooks.createNew'))).toBeTruthy();
  });

  it('renders cookbook cards with names', () => {
    const cookbooks = [
      createCookbook({ id: 'cb-1', name: 'Family', recipeCount: 3 }),
      createCookbook({ id: 'cb-2', name: 'Quick Meals', recipeCount: 5 }),
    ];

    renderWithProviders(
      <CookbookList {...defaultProps} cookbooks={cookbooks} />
    );

    expect(screen.getByText('Family')).toBeTruthy();
    expect(screen.getByText('Quick Meals')).toBeTruthy();
  });

  it('calls onCreatePress when create card is pressed', () => {
    const onCreatePress = jest.fn();

    renderWithProviders(
      <CookbookList {...defaultProps} onCreatePress={onCreatePress} />
    );

    fireEvent.press(
      screen.getByLabelText(i18n.t('cookbooks.a11y.createNewCookbook'))
    );

    expect(onCreatePress).toHaveBeenCalledTimes(1);
  });

  it('calls onCookbookPress with cookbook when card is pressed', () => {
    const onCookbookPress = jest.fn();
    const cookbook = createCookbook({ id: 'cb-1', name: 'Italian', recipeCount: 2 });

    renderWithProviders(
      <CookbookList
        {...defaultProps}
        cookbooks={[cookbook]}
        onCookbookPress={onCookbookPress}
      />
    );

    // CookbookCard uses a11y label like "Open Italian cookbook, 2 recipes"
    const cardLabel = i18n.t('cookbooks.a11y.openCookbook', {
      name: 'Italian',
      count: '2 recipes',
    });
    fireEvent.press(screen.getByLabelText(cardLabel));

    expect(onCookbookPress).toHaveBeenCalledTimes(1);
    expect(onCookbookPress).toHaveBeenCalledWith(cookbook);
  });

  it('does not render cookbook cards while loading', () => {
    const cookbooks = [
      createCookbook({ id: 'cb-1', name: 'Family' }),
    ];

    renderWithProviders(
      <CookbookList {...defaultProps} cookbooks={cookbooks} isLoading={true} />
    );

    expect(screen.queryByText('Family')).toBeNull();
    expect(screen.getByText(i18n.t('common.loading'))).toBeTruthy();
  });
});

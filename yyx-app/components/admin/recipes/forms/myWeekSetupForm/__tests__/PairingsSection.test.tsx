import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PairingsSection } from '../PairingsSection';

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const map: Record<string, string> = {
        'admin.recipes.form.myWeekSetup.pairings.title': 'Pairs well with',
        'admin.recipes.form.myWeekSetup.pairings.emptyBeforeSave':
          'Save first to link pairings.',
        'admin.recipes.form.myWeekSetup.pairings.noneYet': 'No pairings yet.',
        'admin.recipes.form.myWeekSetup.pairings.addCta': 'Add pairing',
        'admin.recipes.form.myWeekSetup.pairings.removeCta': 'Remove pairing',
        'admin.recipes.form.myWeekSetup.pairings.roleLabel': 'Role in the pairing',
        'admin.recipes.form.myWeekSetup.pairings.rolePlaceholder': 'Select a role',
        'admin.recipes.form.myWeekSetup.pairings.roleRequired': 'Pick a role.',
        'admin.recipes.form.myWeekSetup.pairings.reasonLabel': 'Why (optional)',
        'admin.recipes.form.myWeekSetup.pairings.reasonPlaceholder': 'e.g., …',
        'admin.recipes.form.myWeekSetup.pairings.pickerTitle': 'Add recipe',
        'admin.recipes.form.myWeekSetup.pairings.searchPlaceholder': 'Search…',
        'admin.recipes.form.myWeekSetup.pairings.loading': 'Loading…',
        'admin.recipes.form.myWeekSetup.pairings.loadError': 'Load error.',
        'admin.recipes.form.myWeekSetup.pairings.noMatches': 'No matches.',
        'admin.recipes.form.myWeekSetup.pairings.untitledTarget': 'Untitled',
        'admin.recipes.form.myWeekSetup.pairings.roles.side': 'Side',
        'admin.recipes.form.myWeekSetup.pairings.roles.base': 'Base',
        'admin.recipes.form.myWeekSetup.pairings.roles.veg': 'Vegetable',
        'admin.recipes.form.myWeekSetup.pairings.roles.dessert': 'Dessert',
        'admin.recipes.form.myWeekSetup.pairings.roles.beverage': 'Beverage',
        'admin.recipes.form.myWeekSetup.pairings.roles.condiment': 'Condiment',
        'admin.recipes.form.myWeekSetup.pairings.roles.leftover_transform':
          'Leftover transform',
        'common.cancel': 'Cancel',
      };
      return map[key] ?? key;
    },
  },
}));

const mockGetAll = jest.fn();
jest.mock('@/services/admin/adminRecipeService', () => ({
  adminRecipeService: {
    getAllRecipesForAdmin: () => mockGetAll(),
  },
}));

describe('PairingsSection', () => {
  beforeEach(() => {
    mockGetAll.mockReset();
  });

  it('renders empty-before-save message when recipe has no id', () => {
    render(
      <PairingsSection
        recipe={{}}
        onUpdateRecipe={jest.fn()}
        displayLocale="en"
      />,
    );
    expect(screen.getByText('Save first to link pairings.')).toBeTruthy();
    expect(screen.queryByText('Add pairing')).toBeNull();
  });

  it('renders no-pairings helper and add button when recipe has id', () => {
    render(
      <PairingsSection
        recipe={{ id: 'r-1' }}
        onUpdateRecipe={jest.fn()}
        displayLocale="en"
      />,
    );
    expect(screen.getByText('No pairings yet.')).toBeTruthy();
    expect(screen.getByText('Add pairing')).toBeTruthy();
  });

  it('renders existing pairings with target name', () => {
    render(
      <PairingsSection
        recipe={{
          id: 'r-1',
          pairings: [
            {
              id: 'p-1',
              sourceRecipeId: 'r-1',
              targetRecipeId: 'r-2',
              pairingRole: 'side',
              reason: null,
              targetName: 'Rice',
            },
          ],
        }}
        onUpdateRecipe={jest.fn()}
        displayLocale="en"
      />,
    );
    expect(screen.getByText('Rice')).toBeTruthy();
  });

  it('removes a pairing when remove button is pressed', () => {
    const onUpdate = jest.fn();
    render(
      <PairingsSection
        recipe={{
          id: 'r-1',
          pairings: [
            {
              id: 'p-1',
              sourceRecipeId: 'r-1',
              targetRecipeId: 'r-2',
              pairingRole: 'side',
              targetName: 'Rice',
            },
          ],
        }}
        onUpdateRecipe={onUpdate}
        displayLocale="en"
      />,
    );
    fireEvent.press(screen.getByLabelText('Remove pairing'));
    expect(onUpdate).toHaveBeenCalledWith({ pairings: [] });
  });

  it('loads candidates when picker opens', async () => {
    mockGetAll.mockResolvedValue([
      {
        id: 'r-3',
        translations: [{ locale: 'en', name: 'Bread' }],
        plannerRole: 'side',
      },
    ]);
    render(
      <PairingsSection
        recipe={{ id: 'r-1' }}
        onUpdateRecipe={jest.fn()}
        displayLocale="en"
      />,
    );
    fireEvent.press(screen.getByText('Add pairing'));
    await waitFor(() => expect(mockGetAll).toHaveBeenCalled());
  });
});

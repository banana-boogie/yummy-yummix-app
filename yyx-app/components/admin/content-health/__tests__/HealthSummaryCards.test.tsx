import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { HealthSummaryCards } from '../HealthSummaryCards';
import { ContentHealthSummary, IssueFilter } from '@/services/admin/adminContentHealthService';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Ionicons: (props: any) => <View testID={`icon-${props.name}`} />,
  };
});

const mockSummary: ContentHealthSummary = {
  missingTranslations: { total: 93, recipes: 23, ingredients: 45, usefulItems: 25 },
  missingImages: { total: 97, recipes: 40, ingredients: 35, usefulItems: 22 },
  missingNutrition: { total: 26, ingredients: 26 },
  unpublished: { total: 288, recipes: 288 },
};

describe('HealthSummaryCards', () => {
  it('renders all four summary cards with correct counts', () => {
    const onFilterSelect = jest.fn();
    renderWithProviders(
      <HealthSummaryCards
        summary={mockSummary}
        activeFilter="all"
        onFilterSelect={onFilterSelect}
      />
    );

    expect(screen.getByText('93')).toBeTruthy();
    expect(screen.getByText('97')).toBeTruthy();
    expect(screen.getByText('26')).toBeTruthy();
    expect(screen.getByText('288')).toBeTruthy();
  });

  it('calls onFilterSelect when a card is pressed', () => {
    const onFilterSelect = jest.fn();
    renderWithProviders(
      <HealthSummaryCards
        summary={mockSummary}
        activeFilter="all"
        onFilterSelect={onFilterSelect}
      />
    );

    // Press the "Missing Translations" card (contains text "93")
    fireEvent.press(screen.getByText('93'));
    expect(onFilterSelect).toHaveBeenCalledWith('translation');
  });

  it('toggles filter off when pressing an already-active card', () => {
    const onFilterSelect = jest.fn();
    renderWithProviders(
      <HealthSummaryCards
        summary={mockSummary}
        activeFilter="translation"
        onFilterSelect={onFilterSelect}
      />
    );

    fireEvent.press(screen.getByText('93'));
    expect(onFilterSelect).toHaveBeenCalledWith('all');
  });
});

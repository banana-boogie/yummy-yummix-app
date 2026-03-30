/**
 * IngredientCard Component Tests
 *
 * Tests single-locale display behavior:
 * - Shows name for the given displayLocale
 * - Falls back to '—' when translation is missing
 * - Calls onPress when the card is pressed
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { IngredientCard } from '../IngredientCard';
import { AdminIngredient } from '@/types/recipe.admin.types';

jest.mock('@/i18n', () => ({
  t: (key: string, opts?: any) => opts?.defaultValue || key,
}));

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockIngredient: AdminIngredient = {
  id: 'ing-1',
  translations: [
    { locale: 'es', name: 'Tomate', pluralName: 'Tomates' },
    { locale: 'en', name: 'Tomato', pluralName: 'Tomatoes' },
  ],
  pictureUrl: 'https://example.com/tomato.jpg',
  nutritionalFacts: { calories: 20, protein: 1.0, fat: 0.2, carbohydrates: 3.9 },
};

const mockOnPress = jest.fn();

describe('IngredientCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the Spanish name when displayLocale is es', () => {
    renderWithProviders(
      <IngredientCard ingredient={mockIngredient} displayLocale="es" onPress={mockOnPress} />
    );
    expect(screen.getByText('Tomate')).toBeTruthy();
    expect(screen.queryByText('Tomato')).toBeNull();
  });

  it('renders the English name when displayLocale is en', () => {
    renderWithProviders(
      <IngredientCard ingredient={mockIngredient} displayLocale="en" onPress={mockOnPress} />
    );
    expect(screen.getByText('Tomato')).toBeTruthy();
    expect(screen.queryByText('Tomate')).toBeNull();
  });

  it('shows dash when translation is missing for locale', () => {
    const noFrench: AdminIngredient = {
      ...mockIngredient,
      translations: [{ locale: 'es', name: 'Tomate' }],
    };
    renderWithProviders(
      <IngredientCard ingredient={noFrench} displayLocale="fr" onPress={mockOnPress} />
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('calls onPress with the ingredient when the card is pressed', () => {
    renderWithProviders(
      <IngredientCard ingredient={mockIngredient} displayLocale="es" onPress={mockOnPress} />
    );
    fireEvent.press(screen.getByText('Tomate'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
    expect(mockOnPress).toHaveBeenCalledWith(mockIngredient);
  });
});

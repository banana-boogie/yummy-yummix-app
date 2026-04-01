/**
 * KitchenToolCard Component Tests
 *
 * Tests single-locale display behavior:
 * - Shows name for the given displayLocale
 * - Falls back to '—' when translation is missing
 * - Calls onPress when the card is pressed
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { KitchenToolCard } from '../KitchenToolCard';
import { AdminKitchenTool } from '@/types/recipe.admin.types';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockKitchenTool: AdminKitchenTool = {
  id: 'item-1',
  translations: [
    { locale: 'es', name: 'Espátula' },
    { locale: 'en', name: 'Spatula' },
  ],
  pictureUrl: 'https://example.com/spatula.jpg',
};

const mockOnPress = jest.fn();

describe('KitchenToolCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the Spanish name when displayLocale is es', () => {
    renderWithProviders(
      <KitchenToolCard kitchenTool={mockKitchenTool} displayLocale="es" onPress={mockOnPress} />
    );
    expect(screen.getByText('Espátula')).toBeTruthy();
    expect(screen.queryByText('Spatula')).toBeNull();
  });

  it('renders the English name when displayLocale is en', () => {
    renderWithProviders(
      <KitchenToolCard kitchenTool={mockKitchenTool} displayLocale="en" onPress={mockOnPress} />
    );
    expect(screen.getByText('Spatula')).toBeTruthy();
    expect(screen.queryByText('Espátula')).toBeNull();
  });

  it('shows dash when translation is missing for locale', () => {
    const noFrench: AdminKitchenTool = {
      ...mockKitchenTool,
      translations: [{ locale: 'es', name: 'Espátula' }],
    };
    renderWithProviders(
      <KitchenToolCard kitchenTool={noFrench} displayLocale="fr" onPress={mockOnPress} />
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('calls onPress with the kitchen tool when the card is pressed', () => {
    renderWithProviders(
      <KitchenToolCard kitchenTool={mockKitchenTool} displayLocale="es" onPress={mockOnPress} />
    );
    fireEvent.press(screen.getByText('Espátula'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
    expect(mockOnPress).toHaveBeenCalledWith(mockKitchenTool);
  });
});

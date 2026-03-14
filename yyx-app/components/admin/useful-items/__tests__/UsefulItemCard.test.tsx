/**
 * UsefulItemCard Component Tests
 *
 * Tests single-locale display behavior:
 * - Shows name for the given displayLocale
 * - Falls back to '—' when translation is missing
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { UsefulItemCard } from '../UsefulItemCard';
import { AdminUsefulItem } from '@/types/recipe.admin.types';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockUsefulItem: AdminUsefulItem = {
  id: 'item-1',
  translations: [
    { locale: 'es', name: 'Espátula' },
    { locale: 'en', name: 'Spatula' },
  ],
  pictureUrl: 'https://example.com/spatula.jpg',
};

const mockHandlers = {
  onEdit: jest.fn(),
  onDelete: jest.fn(),
};

describe('UsefulItemCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the Spanish name when displayLocale is es', () => {
    renderWithProviders(
      <UsefulItemCard usefulItem={mockUsefulItem} displayLocale="es" {...mockHandlers} />
    );
    expect(screen.getByText('Espátula')).toBeTruthy();
    expect(screen.queryByText('Spatula')).toBeNull();
  });

  it('renders the English name when displayLocale is en', () => {
    renderWithProviders(
      <UsefulItemCard usefulItem={mockUsefulItem} displayLocale="en" {...mockHandlers} />
    );
    expect(screen.getByText('Spatula')).toBeTruthy();
    expect(screen.queryByText('Espátula')).toBeNull();
  });

  it('shows dash when translation is missing for locale', () => {
    const noFrench: AdminUsefulItem = {
      ...mockUsefulItem,
      translations: [{ locale: 'es', name: 'Espátula' }],
    };
    renderWithProviders(
      <UsefulItemCard usefulItem={noFrench} displayLocale="fr" {...mockHandlers} />
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('calls onEdit when edit button is pressed', () => {
    renderWithProviders(
      <UsefulItemCard usefulItem={mockUsefulItem} displayLocale="es" {...mockHandlers} />
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.press(buttons[0]);
    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockUsefulItem);
  });

  it('calls onDelete when delete button is pressed', () => {
    renderWithProviders(
      <UsefulItemCard usefulItem={mockUsefulItem} displayLocale="es" {...mockHandlers} />
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.press(buttons[1]);
    expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockUsefulItem);
  });
});

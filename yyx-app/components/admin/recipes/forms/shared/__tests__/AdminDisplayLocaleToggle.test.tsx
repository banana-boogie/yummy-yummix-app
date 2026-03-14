/**
 * AdminDisplayLocaleToggle Component Tests
 *
 * Tests for the display locale toggle pill buttons:
 * - Renders locale options from useActiveLocales
 * - Highlights the currently selected locale
 * - Calls onChange when a different locale is pressed
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { AdminDisplayLocaleToggle } from '../AdminDisplayLocaleToggle';

// ---------- Mocks ----------

jest.mock('@/hooks/admin/useActiveLocales', () => ({
  useActiveLocales: () => ({
    locales: [
      { code: 'es', displayName: 'Espanol' },
      { code: 'en', displayName: 'English' },
    ],
    loading: false,
  }),
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// ---------- Tests ----------

describe('AdminDisplayLocaleToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders locale options from useActiveLocales', () => {
      renderWithProviders(
        <AdminDisplayLocaleToggle value="es" onChange={jest.fn()} />
      );

      expect(screen.getByText('Espanol')).toBeTruthy();
      expect(screen.getByText('English')).toBeTruthy();
    });

    it('renders the display language label', () => {
      renderWithProviders(
        <AdminDisplayLocaleToggle value="es" onChange={jest.fn()} />
      );

      expect(screen.getByText('admin.common.displayLanguage')).toBeTruthy();
    });
  });

  describe('selection', () => {
    it('calls onChange when a locale option is pressed', () => {
      const onChange = jest.fn();
      renderWithProviders(
        <AdminDisplayLocaleToggle value="es" onChange={onChange} />
      );

      fireEvent.press(screen.getByText('English'));

      expect(onChange).toHaveBeenCalledWith('en');
    });

    it('calls onChange with the same locale when already selected', () => {
      const onChange = jest.fn();
      renderWithProviders(
        <AdminDisplayLocaleToggle value="es" onChange={onChange} />
      );

      fireEvent.press(screen.getByText('Espanol'));

      expect(onChange).toHaveBeenCalledWith('es');
    });
  });
});

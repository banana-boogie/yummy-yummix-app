/**
 * AuthoringLanguagePicker Component Tests
 *
 * Tests for the authoring locale picker and its persistence helpers:
 * - Component rendering with locale options
 * - Selection handling and callback
 * - loadAuthoringLocale / saveAuthoringLocale persistence helpers
 * - Default locale fallback ('es')
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthoringLanguagePicker,
  loadAuthoringLocale,
  saveAuthoringLocale,
} from '../AuthoringLanguagePicker';

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

describe('AuthoringLanguagePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders locale options from useActiveLocales', () => {
      renderWithProviders(
        <AuthoringLanguagePicker value="es" onChange={jest.fn()} />
      );

      expect(screen.getByText('Espanol')).toBeTruthy();
      expect(screen.getByText('English')).toBeTruthy();
    });

    it('renders the authoring language label', () => {
      renderWithProviders(
        <AuthoringLanguagePicker value="es" onChange={jest.fn()} />
      );

      expect(screen.getByText('admin.translate.authoringLanguage')).toBeTruthy();
    });
  });

  // ============================================================
  // SELECTION TESTS
  // ============================================================

  describe('selection', () => {
    it('calls onChange when a locale option is pressed', () => {
      const onChange = jest.fn();
      renderWithProviders(
        <AuthoringLanguagePicker value="es" onChange={onChange} />
      );

      fireEvent.press(screen.getByText('English'));

      expect(onChange).toHaveBeenCalledWith('en');
    });

    it('calls onChange with the same locale when already selected', () => {
      const onChange = jest.fn();
      renderWithProviders(
        <AuthoringLanguagePicker value="es" onChange={onChange} />
      );

      fireEvent.press(screen.getByText('Espanol'));

      expect(onChange).toHaveBeenCalledWith('es');
    });
  });
});

// ============================================================
// HELPER FUNCTION TESTS
// ============================================================

describe('loadAuthoringLocale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure we test the non-web path
    (Platform as any).OS = 'ios';
  });

  it('returns stored locale from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('en');

    const result = await loadAuthoringLocale();

    expect(result).toBe('en');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('admin_authoring_locale');
  });

  it('defaults to es when no stored value exists', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const result = await loadAuthoringLocale();

    expect(result).toBe('es');
  });

  it('defaults to es when AsyncStorage throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
      new Error('Storage unavailable')
    );

    const result = await loadAuthoringLocale();

    expect(result).toBe('es');
  });
});

describe('saveAuthoringLocale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  it('saves locale to AsyncStorage', async () => {
    await saveAuthoringLocale('en');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'admin_authoring_locale',
      'en'
    );
  });

  it('does not throw when AsyncStorage fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
      new Error('Write error')
    );

    await expect(saveAuthoringLocale('en')).resolves.toBeUndefined();
  });
});

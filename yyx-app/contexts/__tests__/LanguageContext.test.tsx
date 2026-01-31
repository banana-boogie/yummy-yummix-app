/**
 * LanguageContext Tests
 *
 * Tests for language context covering:
 * - Language initialization
 * - Language switching
 * - Device language detection
 * - Persistence
 * - i18n integration
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { LanguageProvider, useLanguage } from '../LanguageContext';

// Mock storage with immediate resolution
const mockStorageData: Record<string, string | null> = {};
const mockGetItem = jest.fn((key: string) => Promise.resolve(mockStorageData[key] || null));
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorageData[key] = value;
  return Promise.resolve();
});

jest.mock('@/utils/storage', () => ({
  Storage: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
    removeItem: jest.fn((key: string) => {
      delete mockStorageData[key];
      return Promise.resolve();
    }),
  },
}));

// Mock i18n - must be an object we can mutate
// Using a getter function to ensure the mock is evaluated at runtime
const mockI18nState = { locale: 'en', t: (key: string) => key };
jest.mock('@/i18n', () => {
  return {
    __esModule: true,
    get default() {
      return mockI18nState;
    },
  };
});

// Mock expo-localization
const mockGetLocales = jest.fn(() => [{ languageCode: 'en' }]);
jest.mock('expo-localization', () => ({
  getLocales: () => mockGetLocales(),
}));

describe('LanguageContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LanguageProvider>{children}</LanguageProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear mock storage
    Object.keys(mockStorageData).forEach((key) => delete mockStorageData[key]);
    mockI18nState.locale = 'en';
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
  });

  // ============================================================
  // INITIALIZATION TESTS
  // ============================================================

  describe('initialization', () => {
    it('loads saved language preference', async () => {
      mockGetItem.mockResolvedValueOnce('es');

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await waitFor(
        () => {
          expect(result.current).toBeDefined();
          expect(result.current.language).toBe('es');
        },
        { timeout: 3000 }
      );

      expect(mockI18nState.locale).toBe('es');
    });

    it('detects device language when no saved preference', async () => {
      mockGetItem.mockResolvedValueOnce(null);
      mockGetLocales.mockReturnValue([{ languageCode: 'es' }]);

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await waitFor(
        () => {
          expect(result.current).toBeDefined();
          expect(result.current.language).toBe('es');
        },
        { timeout: 3000 }
      );
    });

    it('defaults to English when device language is not supported', async () => {
      mockGetItem.mockResolvedValueOnce(null);
      mockGetLocales.mockReturnValue([{ languageCode: 'fr' }]);

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await waitFor(
        () => {
          expect(result.current).toBeDefined();
          expect(result.current.language).toBe('en');
        },
        { timeout: 3000 }
      );
    });

    it('handles errors during language loading', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockGetItem.mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await waitFor(
        () => {
          expect(result.current).toBeDefined();
          expect(result.current.language).toBe('en');
        },
        { timeout: 3000 }
      );

      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // LANGUAGE SWITCHING TESTS
  // ============================================================

  describe('setLanguage', () => {
    it('switches language to Spanish', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.language).toBeDefined();
      });

      await act(async () => {
        await result.current.setLanguage('es');
      });

      expect(result.current.language).toBe('es');
      expect(mockI18nState.locale).toBe('es');
    });

    it('switches language to English', async () => {
      mockGetItem.mockResolvedValueOnce('es');

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.language).toBe('es');
      });

      await act(async () => {
        await result.current.setLanguage('en');
      });

      expect(result.current.language).toBe('en');
      expect(mockI18nState.locale).toBe('en');
    });

    it('persists language preference to storage', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.language).toBeDefined();
      });

      mockSetItem.mockClear();

      await act(async () => {
        await result.current.setLanguage('es');
      });

      expect(mockSetItem).toHaveBeenCalledWith('preferred-language', 'es');
    });

    it('does not update when setting same language', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.language).toBe('en');
      });

      mockSetItem.mockClear();

      await act(async () => {
        await result.current.setLanguage('en');
      });

      // Should not call setItem when language hasn't changed
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('handles storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useLanguage(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.language).toBeDefined();
      });

      mockSetItem.mockRejectedValueOnce(new Error('Storage error'));

      await act(async () => {
        await result.current.setLanguage('es');
      });

      // Should still update the state even if storage fails
      expect(result.current.language).toBe('es');

      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // HOOK VALIDATION TESTS
  // ============================================================

  describe('useLanguage hook', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useLanguage());
      }).toThrow('useLanguage must be used within a LanguageProvider');

      consoleSpy.mockRestore();
    });
  });
});

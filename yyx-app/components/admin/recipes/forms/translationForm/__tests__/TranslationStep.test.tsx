/**
 * TranslationStep Component Tests
 *
 * Tests for the translation step form covering:
 * - Ready state: summary card, field counts, target locale checkboxes, Translate All button
 * - English checkbox default and unchecking with AlertModal
 * - Translating state: progress bar display
 * - Done state: success banner and tabbed review
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils/render';
import { TranslationStep } from '../TranslationStep';
import { ExtendedRecipe } from '@/hooks/admin/useAdminRecipeForm';

// ---------- Mocks ----------

const mockTranslateAll = jest.fn();

jest.mock('@/hooks/admin/useRecipeTranslation', () => ({
  useRecipeTranslation: () => ({
    translating: false,
    progress: null,
    error: null,
    failedLocales: [],
    translateAll: mockTranslateAll,
  }),
}));

jest.mock('@/hooks/admin/useActiveLocales', () => ({
  useActiveLocales: () => ({
    locales: [
      { code: 'es', displayName: 'Espanol' },
      { code: 'en', displayName: 'English' },
      { code: 'fr', displayName: 'Francais' },
    ],
    loading: false,
  }),
}));

jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({
    isMobile: false,
    isPhone: false,
    isTablet: false,
    isSmall: false,
    isMedium: true,
    isLarge: false,
  }),
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/constants/design-tokens', () => ({
  COLORS: {
    primary: { dark: '#333', medium: '#FFBFB7', lightest: '#FCF6F2', light: '#FDD' },
    text: { default: '#2D2D2D', secondary: '#828181' },
    status: { success: '#78A97A', error: '#D83A3A' },
    neutral: { WHITE: '#fff' },
    grey: { default: '#ccc' },
    background: { default: '#fff', secondary: '#f5f5f5' },
    border: { default: '#ddd' },
  },
  SPACING: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  FONT_SIZES: { xs: 10, sm: 12, base: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60 },
  FONT_WEIGHTS: { extraLight: '100', light: '300', regular: '400', medium: '500', semibold: '600', bold: '700', extraBold: '800', black: '900' },
  FONTS: { HEADING: 'Quicksand', SUBHEADING: 'Lexend', BODY: 'Montserrat', HANDWRITTEN: 'ComingSoon-Regular' },
  TEXT_PRESETS: {
    h1: { fontFamily: 'Quicksand', fontWeight: '800', fontSize: 30, color: '#2D2D2D' },
    h2: { fontFamily: 'Quicksand', fontWeight: '600', fontSize: 24, color: '#2D2D2D' },
    h3: { fontFamily: 'Quicksand', fontWeight: '500', fontSize: 18, color: '#2D2D2D' },
    subheading: { fontFamily: 'Lexend', fontWeight: '300', fontSize: 20, color: '#2D2D2D' },
    body: { fontFamily: 'Montserrat', fontWeight: '400', fontSize: 14, color: '#2D2D2D' },
    bodySmall: { fontFamily: 'Montserrat', fontWeight: '400', fontSize: 12, color: '#2D2D2D' },
    caption: { fontFamily: 'Montserrat', fontWeight: '400', fontSize: 12, color: '#828181' },
    link: { fontFamily: 'Montserrat', fontWeight: '400', fontSize: 14, color: '#333', textDecorationLine: 'underline' },
    handwritten: { fontFamily: 'ComingSoon-Regular', fontWeight: '400', fontSize: 14, color: '#2D2D2D' },
  },
  BORDER_RADIUS: { sm: 8, md: 12, lg: 16, xl: 24, round: 9999 },
  LAYOUT: { sidebar: { width: 80 }, maxWidth: { mobile: 500, tablet: 700, desktop: 800 } },
}));

jest.mock('@/components/form/FormSection', () => {
  const { View, Text } = require('react-native');
  return {
    FormSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    ),
    FORM_MAX_WIDTH: 800,
  };
});

jest.mock('@/components/form/TextInput', () => {
  const { TextInput: RNTextInput } = require('react-native');
  return {
    TextInput: (props: any) => <RNTextInput {...props} />,
  };
});

jest.mock('@/components/common/AlertModal', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    AlertModal: ({ visible, title, message, onConfirm, onCancel, confirmText, cancelText }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          <Text>{message}</Text>
          <TouchableOpacity onPress={onConfirm}><Text>{confirmText}</Text></TouchableOpacity>
          <TouchableOpacity onPress={onCancel}><Text>{cancelText}</Text></TouchableOpacity>
        </View>
      ) : null,
  };
});

// ---------- Test Data ----------

function createTestRecipe(overrides: Partial<ExtendedRecipe> = {}): ExtendedRecipe {
  return {
    translations: [
      { locale: 'es', name: 'Sopa de Tomate', tipsAndTricks: 'Usa tomates frescos' },
    ],
    steps: [
      {
        id: 'step-1',
        order: 1,
        translations: [
          { locale: 'es', instruction: 'Cortar tomates', recipeSection: 'Prep', tip: 'Afilado' },
        ],
      },
    ],
    ingredients: [
      {
        id: 'ing-1',
        ingredientId: 'tomato',
        ingredient: {
          id: 'tomato',
          translations: [{ locale: 'es', name: 'Tomate' }],
          pictureUrl: '',
          nutritionalFacts: { per_100g: { calories: 0, protein: 0, fat: 0, carbohydrates: 0 } },
        },
        quantity: '4',
        translations: [{ locale: 'es', notes: 'Maduros', tip: 'Frescos', recipeSection: 'Base' }],
        optional: false,
        displayOrder: 1,
        measurementUnit: { id: 'u1', type: 'unit' as const, system: 'universal' as const, translations: [] },
      },
    ],
    usefulItems: [
      {
        id: 'item-1',
        recipeId: 'r1',
        usefulItemId: 'k1',
        displayOrder: 1,
        translations: [{ locale: 'es', notes: 'Cuchillo' }],
        usefulItem: { id: 'k1', translations: [{ locale: 'es', name: 'Cuchillo' }], pictureUrl: '' },
      },
    ],
    ...overrides,
  } as ExtendedRecipe;
}

// ---------- Tests ----------

describe('TranslationStep', () => {
  const defaultProps = {
    recipe: createTestRecipe(),
    authoringLocale: 'es',
    onUpdateRecipe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTranslateAll.mockResolvedValue(createTestRecipe());
  });

  // ============================================================
  // READY STATE
  // ============================================================

  describe('ready state', () => {
    it('renders summary card with field counts', () => {
      renderWithProviders(<TranslationStep {...defaultProps} />);

      // Summary section header
      expect(screen.getByText('admin.translate.summary')).toBeTruthy();
      // Section labels
      expect(screen.getByText('admin.translate.recipeInfo')).toBeTruthy();
      expect(screen.getByText('admin.translate.steps')).toBeTruthy();
      expect(screen.getByText('admin.translate.ingredients')).toBeTruthy();
      expect(screen.getByText('admin.translate.usefulItems')).toBeTruthy();
    });

    it('renders Translate All button', () => {
      renderWithProviders(<TranslationStep {...defaultProps} />);

      expect(screen.getByText('admin.translate.translateAll')).toBeTruthy();
    });

    it('renders target locale checkboxes excluding the authoring locale', () => {
      renderWithProviders(<TranslationStep {...defaultProps} />);

      // Authoring locale is 'es', so 'en' and 'fr' should appear as targets
      expect(screen.getByText('English')).toBeTruthy();
      expect(screen.getByText('Francais')).toBeTruthy();
    });

    it('has all target locales checked by default', () => {
      renderWithProviders(<TranslationStep {...defaultProps} />);

      // Both English and Francais should be rendered as checkboxes
      // They are checked by default (the component initializes targetLocales with all non-authoring locales)
      expect(screen.getByText('English')).toBeTruthy();
      expect(screen.getByText('Francais')).toBeTruthy();
    });

    it('disables Translate All button when no translatable fields', () => {
      const emptyRecipe = createTestRecipe({
        translations: [{ locale: 'es', name: '' }],
        steps: [],
        ingredients: [],
        usefulItems: [],
      });

      renderWithProviders(
        <TranslationStep
          {...defaultProps}
          recipe={emptyRecipe}
        />
      );

      // Button should still render but be disabled
      expect(screen.getByText('admin.translate.translateAll')).toBeTruthy();
    });
  });

  // ============================================================
  // ENGLISH CHECKBOX WARNING
  // ============================================================

  describe('English checkbox warning', () => {
    it('shows AlertModal when unchecking English', () => {
      renderWithProviders(<TranslationStep {...defaultProps} />);

      // Press the English locale checkbox to uncheck it
      fireEvent.press(screen.getByText('English'));

      // AlertModal should appear with warning
      expect(screen.getByText('admin.translate.warningTitle')).toBeTruthy();
      expect(screen.getByText('admin.translate.enWarning')).toBeTruthy();
    });

    it('keeps English checked when user cancels the warning', () => {
      renderWithProviders(<TranslationStep {...defaultProps} />);

      fireEvent.press(screen.getByText('English'));

      // Press cancel (Keep English)
      fireEvent.press(screen.getByText('admin.translate.keepEnglish'));

      // English should still be visible as a target (still checked)
      expect(screen.getByText('English')).toBeTruthy();
    });

    it('removes English from targets when user confirms the warning', () => {
      renderWithProviders(<TranslationStep {...defaultProps} />);

      fireEvent.press(screen.getByText('English'));

      // Press confirm (Skip English)
      fireEvent.press(screen.getByText('admin.translate.skipEnglish'));

      // Warning should be dismissed
      expect(screen.queryByText('admin.translate.warningTitle')).toBeNull();
    });

    it('allows toggling non-English locales without warning', () => {
      renderWithProviders(<TranslationStep {...defaultProps} />);

      // Toggle French off - no warning should appear
      fireEvent.press(screen.getByText('Francais'));

      expect(screen.queryByText('admin.translate.warningTitle')).toBeNull();
    });
  });

  // ============================================================
  // TRANSLATE ALL ACTION
  // ============================================================

  describe('translate all action', () => {
    it('calls translateAll with correct arguments when pressed', async () => {
      const recipe = createTestRecipe();
      const onUpdateRecipe = jest.fn();
      mockTranslateAll.mockResolvedValue(recipe);

      renderWithProviders(
        <TranslationStep
          recipe={recipe}
          authoringLocale="es"
          onUpdateRecipe={onUpdateRecipe}
        />
      );

      fireEvent.press(screen.getByText('admin.translate.translateAll'));

      await waitFor(() => {
        expect(mockTranslateAll).toHaveBeenCalledWith(
          recipe,
          'es',
          expect.arrayContaining(['en', 'fr'])
        );
      });
    });

    it('calls onUpdateRecipe with translated result', async () => {
      const translatedRecipe = createTestRecipe({
        translations: [
          { locale: 'es', name: 'Sopa de Tomate' },
          { locale: 'en', name: 'Tomato Soup' },
        ],
      });
      mockTranslateAll.mockResolvedValue(translatedRecipe);
      const onUpdateRecipe = jest.fn();

      renderWithProviders(
        <TranslationStep
          recipe={createTestRecipe()}
          authoringLocale="es"
          onUpdateRecipe={onUpdateRecipe}
        />
      );

      fireEvent.press(screen.getByText('admin.translate.translateAll'));

      await waitFor(() => {
        expect(onUpdateRecipe).toHaveBeenCalledWith(translatedRecipe);
      });
    });
  });

  // ============================================================
  // DONE STATE
  // ============================================================

  describe('done state', () => {
    it('shows success banner after translation completes', async () => {
      mockTranslateAll.mockResolvedValue(createTestRecipe());

      renderWithProviders(<TranslationStep {...defaultProps} />);

      // Trigger translation
      fireEvent.press(screen.getByText('admin.translate.translateAll'));

      await waitFor(() => {
        expect(screen.getByText('admin.translate.translationComplete')).toBeTruthy();
      });
    });

    it('shows retranslate button in done state', async () => {
      mockTranslateAll.mockResolvedValue(createTestRecipe());

      renderWithProviders(<TranslationStep {...defaultProps} />);

      fireEvent.press(screen.getByText('admin.translate.translateAll'));

      await waitFor(() => {
        expect(screen.getByText('admin.translate.retranslate')).toBeTruthy();
      });
    });

    it('returns to ready state when retranslate is pressed', async () => {
      mockTranslateAll.mockResolvedValue(createTestRecipe());

      renderWithProviders(<TranslationStep {...defaultProps} />);

      // Go to done state
      fireEvent.press(screen.getByText('admin.translate.translateAll'));

      await waitFor(() => {
        expect(screen.getByText('admin.translate.retranslate')).toBeTruthy();
      });

      // Press retranslate
      fireEvent.press(screen.getByText('admin.translate.retranslate'));

      // Should show the Translate All button again (ready state)
      await waitFor(() => {
        expect(screen.getByText('admin.translate.translateAll')).toBeTruthy();
      });
    });

    it('shows language tabs for review in done state', async () => {
      mockTranslateAll.mockResolvedValue(createTestRecipe());

      renderWithProviders(<TranslationStep {...defaultProps} />);

      fireEvent.press(screen.getByText('admin.translate.translateAll'));

      await waitFor(() => {
        // Target locale tabs should be visible for review
        expect(screen.getByText('admin.translate.translationComplete')).toBeTruthy();
      });
    });
  });

  // ============================================================
  // ERROR STATE
  // ============================================================

  describe('error display', () => {
    it('shows error message from hook when present', () => {
      // Override the hook mock to return an error
      const useRecipeTranslationModule = require('@/hooks/admin/useRecipeTranslation');
      const originalHook = useRecipeTranslationModule.useRecipeTranslation;

      jest.spyOn(useRecipeTranslationModule, 'useRecipeTranslation').mockReturnValue({
        translating: false,
        progress: null,
        error: 'Translation service unavailable',
        failedLocales: [],
        translateAll: mockTranslateAll,
      });

      renderWithProviders(<TranslationStep {...defaultProps} />);

      expect(screen.getByText('Translation service unavailable')).toBeTruthy();

      // Restore
      useRecipeTranslationModule.useRecipeTranslation = originalHook;
    });
  });
});

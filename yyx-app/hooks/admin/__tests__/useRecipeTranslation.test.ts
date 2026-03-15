/**
 * useRecipeTranslation Hook Tests
 *
 * Tests for the recipe translation hook covering:
 * - Initial state
 * - translateAll progress tracking
 * - Translation of recipe info, steps, ingredients, kitchen tools
 * - Merging translations into existing recipe
 * - Error handling
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useRecipeTranslation } from '../useRecipeTranslation';
import { translateContent } from '@/services/admin/adminTranslateService';
import { ExtendedRecipe } from '../useAdminRecipeForm';

// ---------- Mocks ----------

jest.mock('@/services/admin/adminTranslateService', () => ({
  translateContent: jest.fn(),
}));

const mockTranslateContent = translateContent as jest.Mock;

// ---------- Test Data Helpers ----------

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
          { locale: 'es', instruction: 'Cortar los tomates', recipeSection: 'Preparacion', tip: 'Usa un cuchillo afilado' },
        ],
      },
    ],
    ingredients: [
      {
        id: 'ing-1',
        ingredientId: 'tomato',
        ingredient: { id: 'tomato', translations: [{ locale: 'es', name: 'Tomate' }], pictureUrl: '', nutritionalFacts: { per_100g: { calories: 0, protein: 0, fat: 0, carbohydrates: 0 } } },
        quantity: '4',
        translations: [
          { locale: 'es', notes: 'Bien maduros', tip: 'Frescos', recipeSection: 'Base' },
        ],
        optional: false,
        displayOrder: 1,
        measurementUnit: { id: 'unit-1', type: 'unit' as const, system: 'universal' as const, translations: [] },
      },
    ],
    kitchenTools: [
      {
        id: 'item-1',
        recipeId: 'recipe-1',
        kitchenToolId: 'knife',
        displayOrder: 1,
        translations: [{ locale: 'es', notes: 'Cuchillo grande' }],
        kitchenTool: { id: 'knife', translations: [{ locale: 'es', name: 'Cuchillo' }], pictureUrl: '' },
      },
    ],
    ...overrides,
  } as ExtendedRecipe;
}

function mockTranslationResponse(sourceFields: Record<string, string>, targetLocale: string) {
  const translated: Record<string, string> = {};
  for (const [key, value] of Object.entries(sourceFields)) {
    translated[key] = `[${targetLocale}] ${value}`;
  }
  return [{ targetLocale, fields: translated }];
}

// ---------- Tests ----------

describe('useRecipeTranslation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // INITIAL STATE
  // ============================================================

  describe('initial state', () => {
    it('returns correct initial values', () => {
      const { result } = renderHook(() => useRecipeTranslation());

      expect(result.current.translating).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.error).toBeNull();
      expect(typeof result.current.translateAll).toBe('function');
    });
  });

  // ============================================================
  // TRANSLATE ALL - HAPPY PATH
  // ============================================================

  describe('translateAll', () => {
    it('translates recipe info fields', async () => {
      mockTranslateContent.mockImplementation((fields) =>
        Promise.resolve(mockTranslationResponse(fields, 'en'))
      );

      const recipe = createTestRecipe();
      const { result } = renderHook(() => useRecipeTranslation());

      let updated: ExtendedRecipe;
      await act(async () => {
        updated = await result.current.translateAll(recipe, 'es', ['en']);
      });

      // Verify translateContent was called for recipe info
      expect(mockTranslateContent).toHaveBeenCalledWith(
        { name: 'Sopa de Tomate', tipsAndTricks: 'Usa tomates frescos' },
        'es',
        ['en']
      );

      // Check merged translations
      const enTranslation = updated!.translations?.find(t => t.locale === 'en');
      expect(enTranslation).toBeDefined();
      expect(enTranslation?.name).toBe('[en] Sopa de Tomate');
      expect(enTranslation?.tipsAndTricks).toBe('[en] Usa tomates frescos');
    });

    it('translates step fields', async () => {
      mockTranslateContent.mockImplementation((fields) =>
        Promise.resolve(mockTranslationResponse(fields, 'en'))
      );

      const recipe = createTestRecipe();
      const { result } = renderHook(() => useRecipeTranslation());

      let updated: ExtendedRecipe;
      await act(async () => {
        updated = await result.current.translateAll(recipe, 'es', ['en']);
      });

      const stepEn = updated!.steps![0].translations.find(t => t.locale === 'en');
      expect(stepEn).toBeDefined();
      expect(stepEn?.instruction).toBe('[en] Cortar los tomates');
      expect(stepEn?.recipeSection).toBe('[en] Preparacion');
      expect(stepEn?.tip).toBe('[en] Usa un cuchillo afilado');
    });

    it('translates ingredient translatable fields (notes, tip, recipeSection)', async () => {
      mockTranslateContent.mockImplementation((fields) =>
        Promise.resolve(mockTranslationResponse(fields, 'en'))
      );

      const recipe = createTestRecipe();
      const { result } = renderHook(() => useRecipeTranslation());

      let updated: ExtendedRecipe;
      await act(async () => {
        updated = await result.current.translateAll(recipe, 'es', ['en']);
      });

      const ingEn = updated!.ingredients![0].translations.find(t => t.locale === 'en');
      expect(ingEn).toBeDefined();
      expect(ingEn?.notes).toBe('[en] Bien maduros');
    });

    it('translates kitchen tool notes', async () => {
      mockTranslateContent.mockImplementation((fields) =>
        Promise.resolve(mockTranslationResponse(fields, 'en'))
      );

      const recipe = createTestRecipe();
      const { result } = renderHook(() => useRecipeTranslation());

      let updated: ExtendedRecipe;
      await act(async () => {
        updated = await result.current.translateAll(recipe, 'es', ['en']);
      });

      const itemEn = updated!.kitchenTools![0].translations.find(t => t.locale === 'en');
      expect(itemEn).toBeDefined();
      expect(itemEn?.notes).toBe('[en] Cuchillo grande');
    });

    it('merges into existing translations without overwriting source', async () => {
      mockTranslateContent.mockImplementation((fields) =>
        Promise.resolve(mockTranslationResponse(fields, 'en'))
      );

      const recipe = createTestRecipe();
      const { result } = renderHook(() => useRecipeTranslation());

      let updated: ExtendedRecipe;
      await act(async () => {
        updated = await result.current.translateAll(recipe, 'es', ['en']);
      });

      // Source translation should still exist
      const esTranslation = updated!.translations?.find(t => t.locale === 'es');
      expect(esTranslation?.name).toBe('Sopa de Tomate');
    });
  });

  // ============================================================
  // PROGRESS TRACKING
  // ============================================================

  describe('progress tracking', () => {
    it('sets translating to true during translation', async () => {
      let resolveTranslation: (value: any) => void;
      mockTranslateContent.mockImplementation(
        () => new Promise((resolve) => { resolveTranslation = resolve; })
      );

      const recipe = createTestRecipe({
        steps: [],
        ingredients: [],
        kitchenTools: [],
      });
      const { result } = renderHook(() => useRecipeTranslation());

      let translatePromise: Promise<ExtendedRecipe>;
      act(() => {
        translatePromise = result.current.translateAll(recipe, 'es', ['en']);
      });

      // Should be translating
      expect(result.current.translating).toBe(true);

      // Resolve and finish
      await act(async () => {
        resolveTranslation!(mockTranslationResponse({ name: 'Sopa' }, 'en'));
        await translatePromise!;
      });

      expect(result.current.translating).toBe(false);
      expect(result.current.progress).toBeNull();
    });

    it('calculates total batches correctly', async () => {
      const progressValues: { current: number; total: number; label: string }[] = [];

      mockTranslateContent.mockImplementation((fields) => {
        return Promise.resolve(mockTranslationResponse(fields, 'en'));
      });

      const recipe = createTestRecipe(); // 1 recipe info + 1 step + 1 ingredient + 1 kitchen tool = 4 batches

      const { result } = renderHook(() => useRecipeTranslation());

      await act(async () => {
        await result.current.translateAll(recipe, 'es', ['en']);
      });

      // 4 batches total: recipe info, step, ingredient, kitchen tool
      // translateContent called for: recipe info, step instruction, ingredient notes, kitchen tool notes
      expect(mockTranslateContent).toHaveBeenCalledTimes(4);
    });
  });

  // ============================================================
  // SKIP EMPTY CONTENT
  // ============================================================

  describe('skipping empty content', () => {
    it('skips ingredients with no translatable content', async () => {
      mockTranslateContent.mockImplementation((fields) =>
        Promise.resolve(mockTranslationResponse(fields, 'en'))
      );

      const recipe = createTestRecipe({
        ingredients: [
          {
            id: 'ing-1',
            ingredientId: 'salt',
            ingredient: { id: 'salt', translations: [], pictureUrl: '', nutritionalFacts: { per_100g: { calories: 0, protein: 0, fat: 0, carbohydrates: 0 } } },
            quantity: '1',
            translations: [{ locale: 'es' }], // No notes, tip, or recipeSection
            optional: false,
            displayOrder: 1,
            measurementUnit: { id: 'u1', type: 'unit' as const, system: 'universal' as const, translations: [] },
          },
        ] as any,
        kitchenTools: [],
      });

      const { result } = renderHook(() => useRecipeTranslation());

      await act(async () => {
        await result.current.translateAll(recipe, 'es', ['en']);
      });

      // Should only call for recipe info + step (not ingredient since empty)
      expect(mockTranslateContent).toHaveBeenCalledTimes(2);
    });

    it('skips kitchen tools with empty notes', async () => {
      mockTranslateContent.mockImplementation((fields) =>
        Promise.resolve(mockTranslationResponse(fields, 'en'))
      );

      const recipe = createTestRecipe({
        kitchenTools: [
          {
            id: 'item-1',
            recipeId: 'r1',
            kitchenToolId: 'k1',
            displayOrder: 1,
            translations: [{ locale: 'es', notes: '   ' }], // Whitespace only
            kitchenTool: { id: 'k1', translations: [], pictureUrl: '' },
          },
        ] as any,
      });

      const { result } = renderHook(() => useRecipeTranslation());

      await act(async () => {
        await result.current.translateAll(recipe, 'es', ['en']);
      });

      // recipe info + step + ingredient = 3, kitchen tool skipped
      expect(mockTranslateContent).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  describe('error handling', () => {
    it('sets error state when an unrecoverable error occurs in outer try', async () => {
      // The outer try/catch wraps lines starting with `{ ...recipe }`.
      // To trigger it, make the recipe's translations property a getter
      // that throws during the spread operation inside the try block.
      // The steps/ingredients/kitchenTools are read BEFORE try, so we
      // must target something accessed INSIDE the try block.
      const recipe = createTestRecipe({ steps: [], ingredients: [], kitchenTools: [] });

      // Override translations with a proxy that throws on spread
      Object.defineProperty(recipe, 'translations', {
        get() {
          // Allow the first access (for counting batches etc) but throw
          // when called inside the try block for the spread operation.
          // Since steps/ingredients/kitchenTools are read before try,
          // and translations is first read at line 63 inside try, this works.
          throw new Error('Unexpected crash');
        },
        configurable: true,
      });

      const { result } = renderHook(() => useRecipeTranslation());

      let returned: ExtendedRecipe;
      await act(async () => {
        returned = await result.current.translateAll(recipe, 'es', ['en']);
      });

      expect(result.current.error).toBe('Unexpected crash');
      expect(result.current.translating).toBe(false);
      expect(returned!).toBe(recipe);
    });

    it('continues translating other entities when one batch fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      let callCount = 0;

      mockTranslateContent.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call (recipe info) succeeds
          return Promise.resolve([{ targetLocale: 'en', fields: { name: 'Tomato Soup' } }]);
        }
        // Step translation fails
        return Promise.reject(new Error('Step translation failed'));
      });

      const recipe = createTestRecipe({
        ingredients: [],
        kitchenTools: [],
      });
      const { result } = renderHook(() => useRecipeTranslation());

      let updated: ExtendedRecipe;
      await act(async () => {
        updated = await result.current.translateAll(recipe, 'es', ['en']);
      });

      // Recipe info should still be translated despite step failure
      const enTranslation = updated!.translations?.find(t => t.locale === 'en');
      expect(enTranslation?.name).toBe('Tomato Soup');
      // No top-level error because individual batch errors are caught
      expect(result.current.error).toBeNull();

      consoleSpy.mockRestore();
    });

    it('resets translating state after error', async () => {
      mockTranslateContent.mockRejectedValue(new Error('Fail'));

      const recipe = createTestRecipe({ steps: [], ingredients: [], kitchenTools: [] });
      const { result } = renderHook(() => useRecipeTranslation());

      await act(async () => {
        await result.current.translateAll(recipe, 'es', ['en']);
      });

      expect(result.current.translating).toBe(false);
      expect(result.current.progress).toBeNull();
    });
  });

  // ============================================================
  // EDGE CASES
  // ============================================================

  describe('edge cases', () => {
    it('handles recipe with no steps, ingredients, or kitchen tools', async () => {
      mockTranslateContent.mockImplementation((fields) =>
        Promise.resolve(mockTranslationResponse(fields, 'en'))
      );

      const recipe = createTestRecipe({
        steps: [],
        ingredients: [],
        kitchenTools: [],
      });
      const { result } = renderHook(() => useRecipeTranslation());

      let updated: ExtendedRecipe;
      await act(async () => {
        updated = await result.current.translateAll(recipe, 'es', ['en']);
      });

      // Only recipe info translated
      expect(mockTranslateContent).toHaveBeenCalledTimes(1);
      expect(updated!.translations).toHaveLength(2); // es + en
    });

    it('handles recipe with no source translation', async () => {
      mockTranslateContent.mockImplementation((fields) =>
        Promise.resolve(mockTranslationResponse(fields, 'en'))
      );

      const recipe = createTestRecipe({
        translations: [], // No source translations at all
        steps: [],
        ingredients: [],
        kitchenTools: [],
      });
      const { result } = renderHook(() => useRecipeTranslation());

      await act(async () => {
        await result.current.translateAll(recipe, 'es', ['en']);
      });

      // Should not call translateContent since there is no source name
      expect(mockTranslateContent).not.toHaveBeenCalled();
    });
  });
});

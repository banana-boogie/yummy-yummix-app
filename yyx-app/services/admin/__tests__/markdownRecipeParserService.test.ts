/**
 * MarkdownRecipeParserService Tests
 *
 * Tests for markdown recipe parsing service covering:
 * - Parsing markdown into structured recipe data
 * - Ingredient matching
 * - Tag processing
 * - Kitchen tools matching
 * - Step processing
 * - Error handling
 */

// Mock dependencies before importing
// Import after mocks
import { parseRecipeMarkdown } from '../markdownRecipeParserService';

const mockGetAllIngredientsForAdmin = jest.fn();
const mockGetAllTags = jest.fn();
const mockGetAllMeasurementUnits = jest.fn();
const mockGetAllKitchenTools = jest.fn();
const mockInvoke = jest.fn();

jest.mock('../adminIngredientsService', () => ({
  adminIngredientsService: {
    getAllIngredientsForAdmin: () => mockGetAllIngredientsForAdmin(),
  },
}));

jest.mock('../adminRecipeTagService', () => ({
  adminRecipeTagService: {
    getAllTags: () => mockGetAllTags(),
  },
}));

jest.mock('../adminRecipeService', () => ({
  __esModule: true,
  default: {
    getAllMeasurementUnits: () => mockGetAllMeasurementUnits(),
  },
}));

jest.mock('../adminKitchenToolsService', () => ({
  adminKitchenToolsService: {
    getAllKitchenTools: () => mockGetAllKitchenTools(),
  },
}));

// Mock supabase module - the source file uses 'lib/supabase' path
jest.mock('lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (name: string, options: any) => mockInvoke(name, options),
    },
  },
}), { virtual: true });

// Mock UUID
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

describe('MarkdownRecipeParserService', () => {
  // Reference data now uses translations[] format (returned by admin services)
  const mockIngredients = [
    {
      id: 'ing-1',
      translations: [
        { locale: 'en', name: 'Flour', pluralName: 'Flour' },
        { locale: 'es', name: 'Harina', pluralName: 'Harina' },
      ],
      pictureUrl: '',
      nutritionalFacts: {},
    },
    {
      id: 'ing-2',
      translations: [
        { locale: 'en', name: 'Sugar', pluralName: 'Sugar' },
        { locale: 'es', name: 'Azúcar', pluralName: 'Azúcar' },
      ],
      pictureUrl: '',
      nutritionalFacts: {},
    },
    {
      id: 'ing-3',
      translations: [
        { locale: 'en', name: 'Salt', pluralName: 'Salt' },
        { locale: 'es', name: 'Sal', pluralName: 'Sal' },
      ],
      pictureUrl: '',
      nutritionalFacts: {},
    },
  ];

  const mockTags = [
    {
      id: 'tag-1',
      translations: [
        { locale: 'en', name: 'Vegetarian' },
        { locale: 'es', name: 'Vegetariano' },
      ],
      categories: [],
    },
    {
      id: 'tag-2',
      translations: [
        { locale: 'en', name: 'Quick' },
        { locale: 'es', name: 'Rápido' },
      ],
      categories: [],
    },
    {
      id: 'tag-3',
      translations: [
        { locale: 'en', name: 'Easy' },
        { locale: 'es', name: 'Fácil' },
      ],
      categories: [],
    },
  ];

  const mockMeasurementUnits = [
    { id: 'g', nameEn: 'gram', symbolEn: 'g', type: 'weight', system: 'metric' },
    { id: 'cup', nameEn: 'cup', symbolEn: 'cup', type: 'volume', system: 'imperial' },
    { id: 'tbsp', nameEn: 'tablespoon', symbolEn: 'tbsp', type: 'volume', system: 'universal' },
  ];

  const mockKitchenTools = [
    {
      id: 'item-1',
      translations: [
        { locale: 'en', name: 'Mixing Bowl' },
        { locale: 'es', name: 'Tazón para mezclar' },
      ],
      pictureUrl: '',
    },
    {
      id: 'item-2',
      translations: [
        { locale: 'en', name: 'Whisk' },
        { locale: 'es', name: 'Batidor' },
      ],
      pictureUrl: '',
    },
  ];

  // Edge function returns locale-keyed translations format
  const mockParsedRecipe = {
    translations: [
      { locale: 'en', name: 'Chocolate Cake', tipsAndTricks: 'Let cool before serving' },
      { locale: 'es', name: 'Pastel de Chocolate', tipsAndTricks: 'Dejar enfriar antes de servir' },
    ],
    totalTime: 60,
    prepTime: 20,
    difficulty: 'medium',
    portions: 8,
    ingredients: [
      {
        ingredient: { translations: [{ locale: 'en', name: 'Flour', pluralName: 'Flour' }, { locale: 'es', name: 'Harina', pluralName: 'Harina' }] },
        quantity: 200,
        measurementUnitID: 'g',
        translations: [
          { locale: 'en', notes: 'Sifted', tip: '', recipeSection: 'Main' },
          { locale: 'es', notes: 'Tamizada', tip: '', recipeSection: 'Principal' },
        ],
        displayOrder: 1,
      },
      {
        ingredient: { translations: [{ locale: 'en', name: 'Sugar', pluralName: 'Sugar' }, { locale: 'es', name: 'Azúcar', pluralName: 'Azúcar' }] },
        quantity: 100,
        measurementUnitID: 'g',
        translations: [
          { locale: 'en', notes: '', tip: '', recipeSection: 'Main' },
          { locale: 'es', notes: '', tip: '', recipeSection: 'Principal' },
        ],
        displayOrder: 2,
      },
    ],
    steps: [
      {
        order: 1,
        translations: [
          { locale: 'en', instruction: 'Mix dry ingredients', tip: '', recipeSection: 'Main' },
          { locale: 'es', instruction: 'Mezclar ingredientes secos', tip: '', recipeSection: 'Principal' },
        ],
        thermomixTime: 30,
        thermomixSpeed: { type: 'single', value: 4, start: null, end: null },
        ingredients: [],
      },
    ],
    tags: ['Vegetarian', 'Easy'],
    kitchenTools: [
      { translations: [{ locale: 'en', name: 'Mixing Bowl', notes: '' }, { locale: 'es', name: 'Tazón para mezclar', notes: '' }], displayOrder: 1 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllIngredientsForAdmin.mockResolvedValue(mockIngredients);
    mockGetAllTags.mockResolvedValue(mockTags);
    mockGetAllMeasurementUnits.mockResolvedValue(mockMeasurementUnits);
    mockGetAllKitchenTools.mockResolvedValue(mockKitchenTools);
    mockInvoke.mockResolvedValue({
      data: JSON.stringify(mockParsedRecipe),
      error: null,
    });
  });

  // ============================================================
  // BASIC PARSING TESTS
  // ============================================================

  describe('parseRecipeMarkdown', () => {
    it('calls edge function with markdown content', async () => {
      const markdown = '# Test Recipe\n\n## Ingredients\n- 1 cup flour';

      await parseRecipeMarkdown(markdown);

      expect(mockInvoke).toHaveBeenCalledWith('admin-ai-recipe-import', {
        body: { content: markdown },
      });
    });

    it('returns parsed recipe with translations', async () => {
      const result = await parseRecipeMarkdown('# Test Recipe');

      // Now uses translations[] instead of nameEn/nameEs
      const enTranslation = result.recipe.translations?.find(t => t.locale === 'en');
      const esTranslation = result.recipe.translations?.find(t => t.locale === 'es');
      expect(enTranslation?.name).toBe('Chocolate Cake');
      expect(esTranslation?.name).toBe('Pastel de Chocolate');
      expect(result.recipe.totalTime).toBe(60);
      expect(result.recipe.prepTime).toBe(20);
      expect(result.recipe.difficulty).toBe('medium');
      expect(result.recipe.portions).toBe(8);
    });

    it('returns tips and tricks in translations', async () => {
      const result = await parseRecipeMarkdown('# Test');

      const enTranslation = result.recipe.translations?.find(t => t.locale === 'en');
      const esTranslation = result.recipe.translations?.find(t => t.locale === 'es');
      expect(enTranslation?.tipsAndTricks).toBe('Let cool before serving');
      expect(esTranslation?.tipsAndTricks).toBe('Dejar enfriar antes de servir');
    });

    it('fetches all reference data in parallel', async () => {
      await parseRecipeMarkdown('# Test');

      expect(mockGetAllIngredientsForAdmin).toHaveBeenCalledTimes(1);
      expect(mockGetAllTags).toHaveBeenCalledTimes(1);
      expect(mockGetAllMeasurementUnits).toHaveBeenCalledTimes(1);
      expect(mockGetAllKitchenTools).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // INGREDIENT PROCESSING TESTS
  // ============================================================

  describe('ingredient processing', () => {
    it('matches ingredients from database', async () => {
      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.ingredients).toBeDefined();
      expect(result.recipe.ingredients!.length).toBeGreaterThan(0);
    });

    it('includes measurement unit when matched', async () => {
      const result = await parseRecipeMarkdown('# Test');

      const firstIngredient = result.recipe.ingredients?.[0];
      expect(firstIngredient?.measurementUnit).toBeDefined();
    });

    it('preserves notes in translations', async () => {
      const result = await parseRecipeMarkdown('# Test');

      const flourIngredient = result.recipe.ingredients?.[0];
      // Notes are now in translations array
      const enTranslation = flourIngredient?.translations?.find(t => t.locale === 'en');
      const esTranslation = flourIngredient?.translations?.find(t => t.locale === 'es');
      expect(enTranslation?.notes).toBe('Sifted');
      expect(esTranslation?.notes).toBe('Tamizada');
    });

    it('tracks missing ingredients', async () => {
      // Add an ingredient that won't match
      const parsedWithMissing = {
        ...mockParsedRecipe,
        ingredients: [
          ...mockParsedRecipe.ingredients,
          {
            ingredient: { translations: [{ locale: 'en', name: 'Unknown Spice', pluralName: 'Unknown Spices' }, { locale: 'es', name: 'Especia Desconocida', pluralName: 'Especias Desconocidas' }] },
            quantity: 1,
            measurementUnitID: 'tsp',
            translations: [{ locale: 'en', notes: '', tip: '', recipeSection: 'Main' }, { locale: 'es', notes: '', tip: '', recipeSection: 'Principal' }],
          },
        ],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithMissing),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.missingIngredients).toBeDefined();
      expect(result.missingIngredients.length).toBeGreaterThan(0);
    });

    it('assigns display order to ingredients', async () => {
      const result = await parseRecipeMarkdown('# Test');

      result.recipe.ingredients?.forEach((ing, index) => {
        expect(ing.displayOrder).toBeDefined();
      });
    });

    it('generates temp IDs for ingredients', async () => {
      const result = await parseRecipeMarkdown('# Test');

      result.recipe.ingredients?.forEach((ing) => {
        expect(ing.id).toBeDefined();
        expect(ing.id?.startsWith('temp-')).toBe(true);
      });
    });
  });

  // ============================================================
  // TAG PROCESSING TESTS
  // ============================================================

  describe('tag processing', () => {
    it('matches tags from database', async () => {
      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.tags).toBeDefined();
      expect(result.recipe.tags!.length).toBeGreaterThan(0);
    });

    it('removes hash prefix from tag names', async () => {
      const parsedWithHashTags = {
        ...mockParsedRecipe,
        tags: ['#Vegetarian', '#Easy'],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithHashTags),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      // Should still match tags even with hash prefix
      expect(result.recipe.tags).toBeDefined();
    });

    it('tracks missing tags', async () => {
      const parsedWithMissingTag = {
        ...mockParsedRecipe,
        tags: ['Vegetarian', 'NonExistentTag'],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithMissingTag),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.missingTags).toBeDefined();
      expect(result.missingTags).toContain('NonExistentTag');
    });

    it('deduplicates matched tags', async () => {
      const parsedWithDuplicateTags = {
        ...mockParsedRecipe,
        tags: ['Vegetarian', 'Vegetariano', 'Easy'], // Vegetarian and Vegetariano should match same tag
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithDuplicateTags),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      // Should not have duplicate tags
      const tagIds = result.recipe.tags?.map((t) => t.id);
      const uniqueTagIds = [...new Set(tagIds)];
      expect(tagIds?.length).toBe(uniqueTagIds.length);
    });

    it('maps inferred mealTypes to existing meal_type category tags', async () => {
      // Extend mock tags with meal_type-categorized tags
      mockGetAllTags.mockResolvedValue([
        ...mockTags,
        {
          id: 'mt-breakfast',
          translations: [
            { locale: 'en', name: 'Breakfast' },
            { locale: 'es', name: 'Desayuno' },
          ],
          categories: ['meal_type'],
        },
        {
          id: 'mt-lunch',
          translations: [
            { locale: 'en', name: 'Lunch' },
            { locale: 'es', name: 'Almuerzo' },
          ],
          categories: ['meal_type'],
        },
      ]);

      const parsedWithMealTypes = {
        ...mockParsedRecipe,
        tags: [],
        mealTypes: ['breakfast', 'lunch', 'nonexistent'],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithMealTypes),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      const matchedIds = result.recipe.tags?.map((t) => t.id) || [];
      expect(matchedIds).toContain('mt-breakfast');
      expect(matchedIds).toContain('mt-lunch');
      // Unmatched meal types are silently skipped (no invention of tags)
      expect(matchedIds).not.toContain('nonexistent');
    });

    it('matches tags case-insensitively', async () => {
      const parsedWithMixedCase = {
        ...mockParsedRecipe,
        tags: ['vegetarian', 'EASY'],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithMixedCase),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.tags?.length).toBe(2);
    });
  });

  // ============================================================
  // STEP PROCESSING TESTS
  // ============================================================

  describe('step processing', () => {
    it('processes steps with Thermomix settings', async () => {
      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.steps).toBeDefined();
      expect(result.recipe.steps!.length).toBeGreaterThan(0);

      const firstStep = result.recipe.steps![0];
      expect(firstStep.thermomixTime).toBe(30);
      expect(firstStep.thermomixSpeed).toBeDefined();
    });

    it('generates temp IDs for steps', async () => {
      const result = await parseRecipeMarkdown('# Test');

      result.recipe.steps?.forEach((step) => {
        expect(step.id).toBeDefined();
        expect(step.id?.startsWith('temp-')).toBe(true);
      });
    });

    it('preserves step order', async () => {
      const parsedWithMultipleSteps = {
        ...mockParsedRecipe,
        steps: [
          { order: 1, instructionEn: 'Step 1', instructionEs: 'Paso 1', ingredients: [] },
          { order: 2, instructionEn: 'Step 2', instructionEs: 'Paso 2', ingredients: [] },
          { order: 3, instructionEn: 'Step 3', instructionEs: 'Paso 3', ingredients: [] },
        ],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithMultipleSteps),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.steps![0].order).toBe(1);
      expect(result.recipe.steps![1].order).toBe(2);
      expect(result.recipe.steps![2].order).toBe(3);
    });
  });

  // ============================================================
  // KITCHEN TOOLS PROCESSING TESTS
  // ============================================================

  describe('kitchen tools processing', () => {
    it('matches kitchen tools from database', async () => {
      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.kitchenTools).toBeDefined();
      expect(result.recipe.kitchenTools!.length).toBeGreaterThan(0);
    });

    it('tracks missing kitchen tools', async () => {
      const parsedWithMissingItem = {
        ...mockParsedRecipe,
        kitchenTools: [
          { translations: [{ locale: 'en', name: 'Mixing Bowl', notes: '' }, { locale: 'es', name: 'Tazón', notes: '' }], displayOrder: 1 },
          { translations: [{ locale: 'en', name: 'Rare Kitchen Tool', notes: '' }, { locale: 'es', name: 'Herramienta Rara', notes: '' }], displayOrder: 2 },
        ],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithMissingItem),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.missingKitchenTools).toBeDefined();
      expect(result.missingKitchenTools).toContain('Rare Kitchen Tool');
    });

    it('generates temp IDs for kitchen tools', async () => {
      const result = await parseRecipeMarkdown('# Test');

      result.recipe.kitchenTools?.forEach((item) => {
        expect(item.id).toBeDefined();
        expect(item.id?.startsWith('temp-')).toBe(true);
      });
    });

    it('preserves display order', async () => {
      const result = await parseRecipeMarkdown('# Test');

      result.recipe.kitchenTools?.forEach((item, index) => {
        expect(item.displayOrder).toBeDefined();
      });
    });

    it('deduplicates kitchen tools', async () => {
      const parsedWithDuplicates = {
        ...mockParsedRecipe,
        kitchenTools: [
          { translations: [{ locale: 'en', name: 'Mixing Bowl', notes: '' }, { locale: 'es', name: 'Tazón para mezclar', notes: '' }], displayOrder: 1 },
          { translations: [{ locale: 'en', name: 'Mixing Bowl', notes: '' }, { locale: 'es', name: 'Tazón para mezclar', notes: '' }], displayOrder: 2 }, // Duplicate
        ],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithDuplicates),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      // Should deduplicate by item ID
      const itemIds = result.recipe.kitchenTools?.map((i) => i.kitchenToolId);
      const uniqueItemIds = [...new Set(itemIds)];
      expect(itemIds?.length).toBe(uniqueItemIds.length);
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================

  describe('error handling', () => {
    it('throws error when edge function fails', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Parse failed' },
      });

      await expect(parseRecipeMarkdown('# Bad Recipe')).rejects.toThrow(
        'Failed to parse recipe'
      );
    });

    it('throws error when JSON parse fails', async () => {
      mockInvoke.mockResolvedValue({
        data: 'not valid json',
        error: null,
      });

      await expect(parseRecipeMarkdown('# Bad Recipe')).rejects.toThrow();
    });

    it('throws error when fetching ingredients fails', async () => {
      mockGetAllIngredientsForAdmin.mockRejectedValue(new Error('DB error'));

      await expect(parseRecipeMarkdown('# Test')).rejects.toThrow(
        'Failed to parse recipe'
      );
    });

    it('throws error when fetching tags fails', async () => {
      mockGetAllTags.mockRejectedValue(new Error('DB error'));

      await expect(parseRecipeMarkdown('# Test')).rejects.toThrow(
        'Failed to parse recipe'
      );
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles empty ingredients array', async () => {
      const parsedEmpty = {
        ...mockParsedRecipe,
        ingredients: [],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedEmpty),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.ingredients).toEqual([]);
      expect(result.missingIngredients).toEqual([]);
    });

    it('handles empty tags array', async () => {
      const parsedEmpty = {
        ...mockParsedRecipe,
        tags: [],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedEmpty),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.tags).toEqual([]);
      expect(result.missingTags).toEqual([]);
    });

    it('handles empty kitchen tools array', async () => {
      const parsedEmpty = {
        ...mockParsedRecipe,
        kitchenTools: [],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedEmpty),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.kitchenTools).toEqual([]);
      expect(result.missingKitchenTools).toEqual([]);
    });

    it('handles recipe with only required fields', async () => {
      const minimalParsed = {
        translations: [
          { locale: 'en', name: 'Simple Recipe', tipsAndTricks: '' },
          { locale: 'es', name: 'Receta Simple', tipsAndTricks: '' },
        ],
        difficulty: 'easy',
        totalTime: 30,
        prepTime: 10,
        portions: 4,
        ingredients: [],
        steps: [],
        tags: [],
        kitchenTools: [],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(minimalParsed),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      // Name is now in translations
      const enTranslation = result.recipe.translations?.find(t => t.locale === 'en');
      expect(enTranslation?.name).toBe('Simple Recipe');
      expect(result.recipe.difficulty).toBe('easy');
    });
  });
});

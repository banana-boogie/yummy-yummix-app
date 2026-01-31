/**
 * MarkdownRecipeParserService Tests
 *
 * Tests for markdown recipe parsing service covering:
 * - Parsing markdown into structured recipe data
 * - Ingredient matching
 * - Tag processing
 * - Useful items matching
 * - Step processing
 * - Error handling
 */

// Mock dependencies before importing
const mockGetAllIngredientsForAdmin = jest.fn();
const mockGetAllTags = jest.fn();
const mockGetAllMeasurementUnits = jest.fn();
const mockGetAllUsefulItems = jest.fn();
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

jest.mock('../adminUsefulItemsService', () => ({
  adminUsefulItemsService: {
    getAllUsefulItems: () => mockGetAllUsefulItems(),
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

// Import after mocks
import { parseRecipeMarkdown } from '../markdownRecipeParserService';

describe('MarkdownRecipeParserService', () => {
  const mockIngredients = [
    {
      id: 'ing-1',
      nameEn: 'Flour',
      nameEs: 'Harina',
      pluralNameEn: 'Flour',
      pluralNameEs: 'Harina',
    },
    {
      id: 'ing-2',
      nameEn: 'Sugar',
      nameEs: 'Azúcar',
      pluralNameEn: 'Sugar',
      pluralNameEs: 'Azúcar',
    },
    {
      id: 'ing-3',
      nameEn: 'Salt',
      nameEs: 'Sal',
      pluralNameEn: 'Salt',
      pluralNameEs: 'Sal',
    },
  ];

  const mockTags = [
    { id: 'tag-1', nameEn: 'Vegetarian', nameEs: 'Vegetariano' },
    { id: 'tag-2', nameEn: 'Quick', nameEs: 'Rápido' },
    { id: 'tag-3', nameEn: 'Easy', nameEs: 'Fácil' },
  ];

  const mockMeasurementUnits = [
    { id: 'g', nameEn: 'gram', symbolEn: 'g', type: 'weight', system: 'metric' },
    { id: 'cup', nameEn: 'cup', symbolEn: 'cup', type: 'volume', system: 'imperial' },
    { id: 'tbsp', nameEn: 'tablespoon', symbolEn: 'tbsp', type: 'volume', system: 'universal' },
  ];

  const mockUsefulItems = [
    { id: 'item-1', nameEn: 'Mixing Bowl', nameEs: 'Tazón para mezclar' },
    { id: 'item-2', nameEn: 'Whisk', nameEs: 'Batidor' },
  ];

  const mockParsedRecipe = {
    nameEn: 'Chocolate Cake',
    nameEs: 'Pastel de Chocolate',
    totalTime: 60,
    prepTime: 20,
    difficulty: 'medium',
    portions: 8,
    tipsAndTricksEn: 'Let cool before serving',
    tipsAndTricksEs: 'Dejar enfriar antes de servir',
    ingredients: [
      {
        ingredient: { nameEn: 'Flour', nameEs: 'Harina', pluralNameEn: 'Flour', pluralNameEs: 'Harina' },
        quantity: 200,
        measurementUnitID: 'g',
        notesEn: 'Sifted',
        notesEs: 'Tamizada',
        displayOrder: 1,
      },
      {
        ingredient: { nameEn: 'Sugar', nameEs: 'Azúcar', pluralNameEn: 'Sugar', pluralNameEs: 'Azúcar' },
        quantity: 100,
        measurementUnitID: 'g',
        notesEn: '',
        notesEs: '',
        displayOrder: 2,
      },
    ],
    steps: [
      {
        order: 1,
        instructionEn: 'Mix dry ingredients',
        instructionEs: 'Mezclar ingredientes secos',
        thermomixTime: 30,
        thermomixSpeed: { type: 'single', value: 4, start: null, end: null },
        ingredients: [],
      },
    ],
    tags: ['Vegetarian', 'Easy'],
    usefulItems: [
      { nameEn: 'Mixing Bowl', nameEs: 'Tazón para mezclar', displayOrder: 1 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllIngredientsForAdmin.mockResolvedValue(mockIngredients);
    mockGetAllTags.mockResolvedValue(mockTags);
    mockGetAllMeasurementUnits.mockResolvedValue(mockMeasurementUnits);
    mockGetAllUsefulItems.mockResolvedValue(mockUsefulItems);
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

      expect(mockInvoke).toHaveBeenCalledWith('parse-recipe-markdown', {
        body: { markdown },
      });
    });

    it('returns parsed recipe with basic fields', async () => {
      const result = await parseRecipeMarkdown('# Test Recipe');

      expect(result.recipe.nameEn).toBe('Chocolate Cake');
      expect(result.recipe.nameEs).toBe('Pastel de Chocolate');
      expect(result.recipe.totalTime).toBe(60);
      expect(result.recipe.prepTime).toBe(20);
      expect(result.recipe.difficulty).toBe('medium');
      expect(result.recipe.portions).toBe(8);
    });

    it('returns tips and tricks', async () => {
      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.tipsAndTricksEn).toBe('Let cool before serving');
      expect(result.recipe.tipsAndTricksEs).toBe('Dejar enfriar antes de servir');
    });

    it('fetches all reference data in parallel', async () => {
      await parseRecipeMarkdown('# Test');

      expect(mockGetAllIngredientsForAdmin).toHaveBeenCalledTimes(1);
      expect(mockGetAllTags).toHaveBeenCalledTimes(1);
      expect(mockGetAllMeasurementUnits).toHaveBeenCalledTimes(1);
      expect(mockGetAllUsefulItems).toHaveBeenCalledTimes(1);
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

    it('preserves notes from parsed data', async () => {
      const result = await parseRecipeMarkdown('# Test');

      const flourIngredient = result.recipe.ingredients?.find(
        (ing) => ing.ingredient?.nameEn === 'Flour'
      );
      expect(flourIngredient?.notesEn).toBe('Sifted');
      expect(flourIngredient?.notesEs).toBe('Tamizada');
    });

    it('tracks missing ingredients', async () => {
      // Add an ingredient that won't match
      const parsedWithMissing = {
        ...mockParsedRecipe,
        ingredients: [
          ...mockParsedRecipe.ingredients,
          {
            ingredient: { nameEn: 'Unknown Spice', nameEs: 'Especia Desconocida' },
            quantity: 1,
            measurementUnitID: 'tsp',
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
  // USEFUL ITEMS PROCESSING TESTS
  // ============================================================

  describe('useful items processing', () => {
    it('matches useful items from database', async () => {
      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.usefulItems).toBeDefined();
      expect(result.recipe.usefulItems!.length).toBeGreaterThan(0);
    });

    it('tracks missing useful items', async () => {
      const parsedWithMissingItem = {
        ...mockParsedRecipe,
        usefulItems: [
          { nameEn: 'Mixing Bowl', nameEs: 'Tazón' },
          { nameEn: 'Rare Kitchen Tool', nameEs: 'Herramienta Rara' },
        ],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithMissingItem),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.missingUsefulItems).toBeDefined();
      expect(result.missingUsefulItems).toContain('Rare Kitchen Tool');
    });

    it('generates temp IDs for useful items', async () => {
      const result = await parseRecipeMarkdown('# Test');

      result.recipe.usefulItems?.forEach((item) => {
        expect(item.id).toBeDefined();
        expect(item.id?.startsWith('temp-')).toBe(true);
      });
    });

    it('preserves display order', async () => {
      const result = await parseRecipeMarkdown('# Test');

      result.recipe.usefulItems?.forEach((item, index) => {
        expect(item.displayOrder).toBeDefined();
      });
    });

    it('deduplicates useful items', async () => {
      const parsedWithDuplicates = {
        ...mockParsedRecipe,
        usefulItems: [
          { nameEn: 'Mixing Bowl', nameEs: 'Tazón para mezclar' },
          { nameEn: 'Mixing Bowl', nameEs: 'Tazón para mezclar' }, // Duplicate
        ],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedWithDuplicates),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      // Should deduplicate by item ID
      const itemIds = result.recipe.usefulItems?.map((i) => i.usefulItemId);
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

    it('handles empty useful items array', async () => {
      const parsedEmpty = {
        ...mockParsedRecipe,
        usefulItems: [],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(parsedEmpty),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.usefulItems).toEqual([]);
      expect(result.missingUsefulItems).toEqual([]);
    });

    it('handles recipe with only required fields', async () => {
      const minimalParsed = {
        nameEn: 'Simple Recipe',
        nameEs: 'Receta Simple',
        difficulty: 'easy',
        totalTime: 30,
        prepTime: 10,
        portions: 4,
        ingredients: [],
        steps: [],
        tags: [],
        usefulItems: [],
      };
      mockInvoke.mockResolvedValue({
        data: JSON.stringify(minimalParsed),
        error: null,
      });

      const result = await parseRecipeMarkdown('# Test');

      expect(result.recipe.nameEn).toBe('Simple Recipe');
      expect(result.recipe.difficulty).toBe('easy');
    });
  });
});

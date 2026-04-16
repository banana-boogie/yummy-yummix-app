/**
 * AdminRecipeService Tests
 *
 * Tests for admin recipe service covering key operations.
 * Note: Tests focus on database interactions; image upload tests
 * are limited due to complex service binding patterns.
 */

// Helper to create a deeply chainable mock
// Import after mocks
import { adminRecipeService } from '../adminRecipeService';

const createChainableMock = (resolvedValue: any = { data: null, error: null }) => {
  const chainable: any = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'single', 'maybeSingle', 'order', 'from'];

  methods.forEach(method => {
    chainable[method] = jest.fn().mockReturnValue(chainable);
  });

  // Make terminal methods resolve
  chainable.single = jest.fn().mockResolvedValue(resolvedValue);
  chainable.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  chainable.order = jest.fn().mockResolvedValue(resolvedValue);
  chainable.eq = jest.fn().mockImplementation(() => {
    const result = { ...chainable };
    result.single = jest.fn().mockResolvedValue(resolvedValue);
    result.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
    return result;
  });

  return chainable;
};

let mockChain = createChainableMock();
const mockFrom = jest.fn().mockImplementation(() => mockChain);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock imageService
jest.mock('@/services/storage/imageService', () => ({
  imageService: {
    uploadImage: jest.fn().mockResolvedValue('https://example.com/uploaded.png'),
    deleteImage: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('AdminRecipeService', () => {
  const mockRecipe = {
    id: 'recipe-1',
    image_url: 'https://example.com/cake.png',
    difficulty: 'medium',
    prep_time: 30,
    total_time: 60,
    portions: 8,
    is_published: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    translations: [
      { locale: 'en', name: 'Chocolate Cake', tips_and_tricks: null },
      { locale: 'es', name: 'Pastel de Chocolate', tips_and_tricks: null },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChainableMock({ data: [mockRecipe], error: null });
    mockFrom.mockImplementation(() => mockChain);
  });

  // ============================================================
  // GET ALL RECIPES TESTS
  // ============================================================

  describe('getAllRecipesForAdmin', () => {
    it('fetches all recipes from recipes table', async () => {
      mockChain = createChainableMock({ data: [mockRecipe], error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getAllRecipesForAdmin();

      expect(mockFrom).toHaveBeenCalledWith('recipes');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns empty array when no recipes exist', async () => {
      mockChain = createChainableMock({ data: [], error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getAllRecipesForAdmin();

      expect(result).toEqual([]);
    });

    it('transforms recipe data to include translations array', async () => {
      mockChain = createChainableMock({ data: [mockRecipe], error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getAllRecipesForAdmin();

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('translations');
        expect(Array.isArray(result[0].translations)).toBe(true);
      }
    });
  });

  // ============================================================
  // GET RECIPE BY ID TESTS
  // ============================================================

  describe('getRecipeById', () => {
    it('fetches recipe with all relations', async () => {
      const recipeWithRelations = {
        ...mockRecipe,
        ingredients: [],
        steps: [],
        tags: [],
        kitchen_tools: [],
      };
      mockChain = createChainableMock({ data: recipeWithRelations, error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getRecipeById('recipe-1');

      expect(mockFrom).toHaveBeenCalledWith('recipes');
      expect(result).toBeTruthy();
    });

    it('returns null when recipe not found', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getRecipeById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // TOGGLE PUBLISHED TESTS
  // ============================================================

  describe('toggleRecipePublished', () => {
    it('updates recipe to published state', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.toggleRecipePublished('recipe-1', true);

      expect(mockFrom).toHaveBeenCalledWith('recipes');
      expect(mockChain.update).toHaveBeenCalledWith({ is_published: true });
    });

    it('updates recipe to unpublished state', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.toggleRecipePublished('recipe-1', false);

      expect(mockChain.update).toHaveBeenCalledWith({ is_published: false });
    });

    it('throws error when update fails', async () => {
      mockChain = createChainableMock();
      mockChain.eq = jest.fn().mockResolvedValue({ error: { message: 'Update failed' } });
      mockFrom.mockImplementation(() => mockChain);

      await expect(
        adminRecipeService.toggleRecipePublished('recipe-1', true)
      ).rejects.toThrow('Error toggling recipe published state: Update failed');
    });
  });

  // ============================================================
  // MEASUREMENT UNITS TESTS
  // ============================================================

  describe('getAllMeasurementUnits', () => {
    it('fetches from measurement_units table', async () => {
      const mockUnits = [
        {
          id: 'unit-1',
          type: 'weight',
          system: 'metric',
          translations: [
            { locale: 'en', name: 'gram', name_plural: 'grams', symbol: 'g', symbol_plural: 'g' },
            { locale: 'es', name: 'gramo', name_plural: 'gramos', symbol: 'g', symbol_plural: 'g' },
          ],
        },
      ];
      mockChain = createChainableMock({ data: mockUnits, error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.getAllMeasurementUnits();

      expect(mockFrom).toHaveBeenCalledWith('measurement_units');
    });

    it('returns transformed measurement units', async () => {
      const mockUnits = [
        {
          id: 'unit-1',
          type: 'weight',
          system: 'metric',
          translations: [
            { locale: 'en', name: 'gram', name_plural: 'grams', symbol: 'g', symbol_plural: 'g' },
          ],
        },
      ];
      mockChain = createChainableMock({ data: mockUnits, error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getAllMeasurementUnits();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================
  // TAGS TESTS
  // ============================================================

  describe('getAllTags', () => {
    it('fetches from recipe_tags table', async () => {
      const mockTags = [
        {
          id: 'tag-1',
          categories: ['diet'],
          translations: [
            { locale: 'en', name: 'Vegetarian' },
            { locale: 'es', name: 'Vegetariano' },
          ],
        },
      ];
      mockChain = createChainableMock({ data: mockTags, error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.getAllTags();

      expect(mockFrom).toHaveBeenCalledWith('recipe_tags');
    });

    it('returns array of tags', async () => {
      const mockTags = [
        {
          id: 'tag-1',
          categories: ['diet'],
          translations: [
            { locale: 'en', name: 'Vegetarian' },
            { locale: 'es', name: 'Vegetariano' },
          ],
        },
        {
          id: 'tag-2',
          categories: ['time'],
          translations: [
            { locale: 'en', name: 'Quick' },
            { locale: 'es', name: 'Rápido' },
          ],
        },
      ];
      mockChain = createChainableMock({ data: mockTags, error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getAllTags();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================
  // CREATE RECIPE TESTS
  // ============================================================

  describe('createRecipe', () => {
    it('inserts recipe and returns id', async () => {
      mockChain = createChainableMock({ data: { id: 'new-recipe-id' }, error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.createRecipe({
        translations: [
          { locale: 'en', name: 'Test Recipe' },
          { locale: 'es', name: 'Receta de Prueba' },
        ],
      });

      expect(result).toBe('new-recipe-id');
      expect(mockFrom).toHaveBeenCalledWith('recipes');
    });

    it('throws error when insert fails', async () => {
      mockChain = createChainableMock({ data: null, error: { message: 'Insert failed' } });
      mockFrom.mockImplementation(() => mockChain);

      await expect(
        adminRecipeService.createRecipe({ translations: [{ locale: 'en', name: 'Test' }] })
      ).rejects.toThrow('Failed to create recipe: Insert failed');
    });

    it('creates recipe with ingredients', async () => {
      mockChain = createChainableMock({ data: { id: 'new-id' }, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.createRecipe({
        nameEn: 'Test',
        ingredients: [{ ingredientId: 'ing-1', quantity: '100' }],
      });

      expect(mockFrom).toHaveBeenCalledWith('recipe_ingredients');
    });

    it('creates recipe with tags', async () => {
      mockChain = createChainableMock({ data: { id: 'new-id' }, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.createRecipe({
        nameEn: 'Test',
        tags: [{ id: 'tag-1' }],
      });

      expect(mockFrom).toHaveBeenCalledWith('recipe_to_tag');
    });

    it('creates recipe with steps', async () => {
      mockChain = createChainableMock({ data: { id: 'new-id' }, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.createRecipe({
        nameEn: 'Test',
        steps: [{ order: 1, instructionEn: 'Step 1' }],
      });

      expect(mockFrom).toHaveBeenCalledWith('recipe_steps');
    });

    it('creates recipe with kitchen tools', async () => {
      mockChain = createChainableMock({ data: { id: 'new-id' }, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.createRecipe({
        nameEn: 'Test',
        kitchenTools: [{ kitchenToolId: 'item-1', displayOrder: 0 }],
      });

      expect(mockFrom).toHaveBeenCalledWith('recipe_kitchen_tools');
    });

    it('persists all My Week Setup planner metadata (snake_case) on insert', async () => {
      mockChain = createChainableMock({ data: { id: 'new-id' }, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.createRecipe({
        translations: [{ locale: 'en', name: 'Planner Recipe' }],
        plannerRole: 'main',
        foodGroups: ['protein', 'carb'],
        isCompleteMeal: true,
        equipmentTags: ['thermomix'],
        cookingLevel: 'intermediate',
        leftoversFriendly: true,
        batchFriendly: false,
        maxHouseholdSizeSupported: 6,
        requiresMultiBatchNote: 'Scale in two batches.',
        verifiedAt: '2026-04-13T00:00:00.000Z',
        verifiedBy: 'user-1',
      } as any);

      expect(mockChain.insert).toHaveBeenCalled();
      const insertedRows = mockChain.insert.mock.calls.find(
        (call: any[]) => call[0] && (call[0].planner_role !== undefined || 'planner_role' in call[0])
      );
      expect(insertedRows).toBeDefined();
      const row = insertedRows![0];
      expect(row.planner_role).toBe('main');
      expect(row.food_groups).toEqual(['protein', 'carb']);
      expect(row.is_complete_meal).toBe(true);
      expect(row.equipment_tags).toEqual(['thermomix']);
      expect(row.cooking_level).toBe('intermediate');
      expect(row.leftovers_friendly).toBe(true);
      expect(row.batch_friendly).toBe(false);
      expect(row.max_household_size_supported).toBe(6);
      expect(row.requires_multi_batch_note).toBe('Scale in two batches.');
      expect(row.verified_at).toBe('2026-04-13T00:00:00.000Z');
      expect(row.verified_by).toBe('user-1');
    });

    it('getRecipeById returns planner metadata mapped to camelCase', async () => {
      const fromDb = {
        id: 'recipe-42',
        difficulty: 'easy',
        prep_time: 10,
        total_time: 30,
        portions: 4,
        is_published: true,
        planner_role: 'side',
        food_groups: ['veg'],
        is_complete_meal: false,
        equipment_tags: ['oven'],
        cooking_level: 'beginner',
        leftovers_friendly: false,
        batch_friendly: true,
        max_household_size_supported: 4,
        requires_multi_batch_note: null,
        verified_at: '2026-04-01T12:00:00.000Z',
        verified_by: 'admin-1',
        translations: [{ locale: 'en', name: 'Side Salad', tips_and_tricks: null }],
        ingredients: [],
        steps: [],
        tags: [],
        kitchen_tools: [],
      };
      mockChain = createChainableMock({ data: fromDb, error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getRecipeById('recipe-42');

      expect(result).toBeTruthy();
      expect(result!.plannerRole).toBe('side');
      expect(result!.foodGroups).toEqual(['veg']);
      expect(result!.isCompleteMeal).toBe(false);
      expect(result!.equipmentTags).toEqual(['oven']);
      expect(result!.cookingLevel).toBe('beginner');
      expect(result!.leftoversFriendly).toBe(false);
      expect(result!.batchFriendly).toBe(true);
      expect(result!.maxHouseholdSizeSupported).toBe(4);
      expect(result!.requiresMultiBatchNote).toBeNull();
      expect(result!.verifiedAt).toBe('2026-04-01T12:00:00.000Z');
      expect(result!.verifiedBy).toBe('admin-1');
    });

    it('getRecipeById resolves verifiedByName from user_profiles (name preferred)', async () => {
      const recipeRow = {
        id: 'recipe-7',
        verified_by: 'admin-uuid',
        translations: [{ locale: 'en', name: 'R', tips_and_tricks: null }],
        ingredients: [],
        steps: [],
        tags: [],
        kitchen_tools: [],
      };
      const recipeChain = createChainableMock({ data: recipeRow, error: null });
      const profileChain = createChainableMock({
        data: { name: 'Ana', username: 'ana99', email: 'ana@example.com' },
        error: null,
      });
      mockFrom.mockImplementation((table: string) =>
        table === 'user_profiles' ? profileChain : recipeChain,
      );

      const result = await adminRecipeService.getRecipeById('recipe-7');

      expect(result!.verifiedByName).toBe('Ana');
    });

    it('getRecipeById falls back through username then email', async () => {
      const recipeRow = {
        id: 'recipe-7',
        verified_by: 'admin-uuid',
        translations: [{ locale: 'en', name: 'R', tips_and_tricks: null }],
        ingredients: [],
        steps: [],
        tags: [],
        kitchen_tools: [],
      };
      const recipeChain = createChainableMock({ data: recipeRow, error: null });
      const profileChain = createChainableMock({
        data: { name: null, username: null, email: 'ops@example.com' },
        error: null,
      });
      mockFrom.mockImplementation((table: string) =>
        table === 'user_profiles' ? profileChain : recipeChain,
      );

      const result = await adminRecipeService.getRecipeById('recipe-7');

      expect(result!.verifiedByName).toBe('ops@example.com');
    });

    it('getRecipeById omits profile query when verified_by is null', async () => {
      const recipeRow = {
        id: 'recipe-7',
        verified_by: null,
        translations: [{ locale: 'en', name: 'R', tips_and_tricks: null }],
        ingredients: [],
        steps: [],
        tags: [],
        kitchen_tools: [],
      };
      mockChain = createChainableMock({ data: recipeRow, error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getRecipeById('recipe-7');

      expect(result!.verifiedByName).toBeUndefined();
      expect(mockFrom).not.toHaveBeenCalledWith('user_profiles');
    });
  });

  // ============================================================
  // UPDATE RECIPE RELATION TESTS
  // ============================================================

  describe('updateRecipeIngredients', () => {
    it('deletes existing ingredients before inserting new ones', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.updateRecipeIngredients('recipe-1', [
        { ingredientId: 'ing-1', quantity: '100', displayOrder: 0 },
      ]);

      expect(mockFrom).toHaveBeenCalledWith('recipe_ingredients');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.insert).toHaveBeenCalled();
    });

    it('handles empty ingredients array', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.updateRecipeIngredients('recipe-1', []);

      expect(mockChain.delete).toHaveBeenCalled();
      // Insert should not be called for empty array
    });

    it('throws error when delete fails', async () => {
      mockChain = createChainableMock();
      mockChain.eq = jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } });
      mockFrom.mockImplementation(() => mockChain);

      await expect(
        adminRecipeService.updateRecipeIngredients('recipe-1', [])
      ).rejects.toThrow('Failed to delete existing recipeIngredients: Delete failed');
    });

    it('sorts ingredients by displayOrder before inserting (regression)', async () => {
      // Track insert calls to verify order
      const insertedData: any[] = [];
      mockFrom.mockImplementation((table: string) => {
        if (table === 'recipe_ingredients') {
          return {
            delete: () => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
            insert: (data: any) => {
              insertedData.push(...data);
              return {
                select: jest.fn().mockResolvedValue({
                  data: data.map((d: any, i: number) => ({ id: `id-${i}`, display_order: i + 1 })),
                  error: null,
                }),
              };
            },
          };
        }
        return mockChain;
      });

      // Pass ingredients with out-of-order displayOrder values
      // This simulates a drag-and-drop reorder where array position ≠ displayOrder
      await adminRecipeService.updateRecipeIngredients('recipe-1', [
        { ingredientId: 'ing-a', quantity: '100', displayOrder: 3, optional: false, measurementUnit: { id: 'u1' } },
        { ingredientId: 'ing-b', quantity: '200', displayOrder: 1, optional: false, measurementUnit: { id: 'u1' } },
        { ingredientId: 'ing-c', quantity: '50', displayOrder: 2, optional: false, measurementUnit: { id: 'u1' } },
      ] as any);

      // Should be sorted by displayOrder: b(1), c(2), a(3)
      expect(insertedData).toHaveLength(3);
      expect(insertedData[0].ingredient_id).toBe('ing-b');
      expect(insertedData[1].ingredient_id).toBe('ing-c');
      expect(insertedData[2].ingredient_id).toBe('ing-a');

      // Display orders should be renumbered 1-based contiguously
      expect(insertedData[0].display_order).toBe(1);
      expect(insertedData[1].display_order).toBe(2);
      expect(insertedData[2].display_order).toBe(3);
    });
  });

  describe('updateRecipeTags', () => {
    it('deletes existing tags before inserting new ones', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.updateRecipeTags('recipe-1', [
        { id: 'tag-1' },
      ]);

      expect(mockFrom).toHaveBeenCalledWith('recipe_to_tag');
      expect(mockChain.delete).toHaveBeenCalled();
    });

    it('throws error when delete fails', async () => {
      mockChain = createChainableMock();
      mockChain.eq = jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } });
      mockFrom.mockImplementation(() => mockChain);

      await expect(
        adminRecipeService.updateRecipeTags('recipe-1', [])
      ).rejects.toThrow('Failed to delete existing tag mappings: Delete failed');
    });
  });

  describe('updateRecipeKitchenTools', () => {
    it('deletes existing items before inserting new ones', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.updateRecipeKitchenTools('recipe-1', [
        { kitchenToolId: 'item-1', displayOrder: 0 },
      ]);

      expect(mockFrom).toHaveBeenCalledWith('recipe_kitchen_tools');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.insert).toHaveBeenCalled();
    });

    it('throws error when delete fails', async () => {
      mockChain = createChainableMock();
      mockChain.eq = jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } });
      mockFrom.mockImplementation(() => mockChain);

      await expect(
        adminRecipeService.updateRecipeKitchenTools('recipe-1', [])
      ).rejects.toThrow('Failed to delete existing kitchen tools: Delete failed');
    });
  });
});

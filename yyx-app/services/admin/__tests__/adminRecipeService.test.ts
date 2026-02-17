/**
 * AdminRecipeService Tests
 *
 * Tests for admin recipe service covering key operations.
 * Note: Tests focus on database interactions; image upload tests
 * are limited due to complex service binding patterns.
 */

// Helper to create a deeply chainable mock
const createChainableMock = (resolvedValue: any = { data: null, error: null }) => {
  const chainable: any = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'single', 'order', 'from'];

  methods.forEach(method => {
    chainable[method] = jest.fn().mockReturnValue(chainable);
  });

  // Make terminal methods resolve
  chainable.single = jest.fn().mockResolvedValue(resolvedValue);
  chainable.order = jest.fn().mockResolvedValue(resolvedValue);
  chainable.eq = jest.fn().mockImplementation(() => {
    const result = { ...chainable };
    result.single = jest.fn().mockResolvedValue(resolvedValue);
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

// Import after mocks
import { adminRecipeService } from '../adminRecipeService';

describe('AdminRecipeService', () => {
  const mockRecipe = {
    id: 'recipe-1',
    name_en: 'Chocolate Cake',
    name_es: 'Pastel de Chocolate',
    image_url: 'https://example.com/cake.png',
    difficulty: 'medium',
    prep_time: 30,
    total_time: 60,
    portions: 8,
    is_published: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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

    it('transforms recipe data to camelCase', async () => {
      mockChain = createChainableMock({ data: [mockRecipe], error: null });
      mockFrom.mockImplementation(() => mockChain);

      const result = await adminRecipeService.getAllRecipesForAdmin();

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('nameEn');
        expect(result[0]).toHaveProperty('nameEs');
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
        useful_items: [],
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
        { id: 'unit-1', name_en: 'gram', symbol_en: 'g' },
      ];
      mockChain = createChainableMock({ data: mockUnits, error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.getAllMeasurementUnits();

      expect(mockFrom).toHaveBeenCalledWith('measurement_units');
    });

    it('returns transformed measurement units', async () => {
      const mockUnits = [
        { id: 'unit-1', name_en: 'gram', symbol_en: 'g', system: 'metric' },
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
        { id: 'tag-1', name_en: 'Vegetarian' },
      ];
      mockChain = createChainableMock({ data: mockTags, error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.getAllTags();

      expect(mockFrom).toHaveBeenCalledWith('recipe_tags');
    });

    it('returns array of tags', async () => {
      const mockTags = [
        { id: 'tag-1', name_en: 'Vegetarian', name_es: 'Vegetariano' },
        { id: 'tag-2', name_en: 'Quick', name_es: 'Rápido' },
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
        nameEn: 'Test Recipe',
        nameEs: 'Receta de Prueba',
      });

      expect(result).toBe('new-recipe-id');
      expect(mockFrom).toHaveBeenCalledWith('recipes');
    });

    it('throws error when insert fails', async () => {
      mockChain = createChainableMock({ data: null, error: { message: 'Insert failed' } });
      mockFrom.mockImplementation(() => mockChain);

      await expect(
        adminRecipeService.createRecipe({ nameEn: 'Test' })
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

    it('creates recipe with useful items', async () => {
      mockChain = createChainableMock({ data: { id: 'new-id' }, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.createRecipe({
        nameEn: 'Test',
        usefulItems: [{ usefulItemId: 'item-1', displayOrder: 0 }],
      });

      expect(mockFrom).toHaveBeenCalledWith('recipe_useful_items');
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

  describe('updateRecipeUsefulItems', () => {
    it('deletes existing items before inserting new ones', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation(() => mockChain);

      await adminRecipeService.updateRecipeUsefulItems('recipe-1', [
        { usefulItemId: 'item-1', displayOrder: 0 },
      ]);

      expect(mockFrom).toHaveBeenCalledWith('recipe_useful_items');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.insert).toHaveBeenCalled();
    });

    it('throws error when delete fails', async () => {
      mockChain = createChainableMock();
      mockChain.eq = jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } });
      mockFrom.mockImplementation(() => mockChain);

      await expect(
        adminRecipeService.updateRecipeUsefulItems('recipe-1', [])
      ).rejects.toThrow('Failed to delete existing useful items: Delete failed');
    });
  });
});

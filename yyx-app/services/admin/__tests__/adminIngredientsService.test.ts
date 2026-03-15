/**
 * AdminIngredientsService Tests
 *
 * Tests for admin ingredients service covering:
 * - Fetching all ingredients
 * - Creating ingredients
 * - Updating ingredients
 * - Deleting ingredients
 * - Image handling
 */

import { AdminIngredientsService } from '../adminIngredientsService';

// Mock Supabase
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockDelete = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockUpsert = jest.fn();

const mockSupabase = {
  from: mockFrom,
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock imageService
const mockUploadImage = jest.fn();
const mockDeleteImage = jest.fn();

jest.mock('../../storage/imageService', () => ({
  imageService: {
    uploadImage: {
      bind: () => mockUploadImage,
    },
    deleteImage: {
      bind: () => mockDeleteImage,
    },
  },
}));

// Mock BaseService
jest.mock('../../base/BaseService', () => ({
  BaseService: class MockBaseService {
    supabase = mockSupabase;

    async transformedUpdate<T>(table: string, id: string, data: any): Promise<T> {
      const result = await mockSupabase.from(table).update(data).eq('id', id).select().single();
      return result.data;
    }

    async transformedInsert<T>(table: string, data: any): Promise<T> {
      const result = await mockSupabase.from(table).insert(data).select().single();
      return result.data;
    }

    async transformedSelect<T>(query: any): Promise<T> {
      const result = await query;
      return result.data;
    }

    uploadImage = mockUploadImage;
    deleteImage = mockDeleteImage;
  },
}));

describe('AdminIngredientsService', () => {
  let service: AdminIngredientsService;

  const mockIngredient = {
    id: 'ing-1',
    image_url: 'https://example.com/tomato.png',
    translations: [
      { locale: 'en', name: 'Tomato', plural_name: 'Tomatoes' },
      { locale: 'es', name: 'Tomate', plural_name: 'Tomates' },
    ],
    nutrition: [{ calories: 20, protein: 1.0, fat: 0.2, carbohydrates: 3.9, source: 'openai:gpt-4o-mini' }],
  };

  const mockTransformedIngredient = {
    id: 'ing-1',
    translations: [
      { locale: 'en', name: 'Tomato', pluralName: 'Tomatoes' },
      { locale: 'es', name: 'Tomate', pluralName: 'Tomates' },
    ],
    pictureUrl: 'https://example.com/tomato.png',
    nutritionalFacts: { calories: 20, protein: 1.0, fat: 0.2, carbohydrates: 3.9 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminIngredientsService();

    // Setup default mock chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      delete: mockDelete,
      insert: mockInsert,
      update: mockUpdate,
      upsert: mockUpsert,
    });
    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
      single: mockSingle,
    });
    mockOrder.mockResolvedValue({ data: [mockIngredient], error: null });
    mockEq.mockReturnValue({
      single: mockSingle,
      select: mockSelect,
    });
    mockSingle.mockResolvedValue({ data: mockIngredient, error: null });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockUpsert.mockResolvedValue({ error: null });
  });

  // ============================================================
  // GET ALL INGREDIENTS TESTS
  // ============================================================

  describe('getAllIngredientsForAdmin', () => {
    it('fetches all ingredients with default sort', async () => {
      const result = await service.getAllIngredientsForAdmin();

      expect(mockFrom).toHaveBeenCalledWith('ingredients');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockTransformedIngredient);
    });

    it('sorts by Spanish name client-side', async () => {
      const result = await service.getAllIngredientsForAdmin('es');

      // Still fetches from same table, sorting happens client-side now
      expect(mockFrom).toHaveBeenCalledWith('ingredients');
      expect(result).toHaveLength(1);
    });

    it('throws error when fetch fails', async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.getAllIngredientsForAdmin()).rejects.toThrow(
        'Error fetching ingredients: Database error'
      );
    });

    it('returns empty array when no ingredients', async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });

      const result = await service.getAllIngredientsForAdmin();

      expect(result).toEqual([]);
    });

    it('transforms missing translations to empty array', async () => {
      mockOrder.mockResolvedValue({
        data: [{ id: 'ing-2', image_url: null, translations: [], nutrition: null }],
        error: null,
      });

      const result = await service.getAllIngredientsForAdmin();

      expect(result[0].translations).toEqual([]);
    });
  });

  // ============================================================
  // CREATE INGREDIENT TESTS
  // ============================================================

  describe('createIngredient', () => {
    it('creates ingredient without image', async () => {
      const newIngredient = {
        translations: [
          { locale: 'en', name: 'Onion', pluralName: 'Onions' },
          { locale: 'es', name: 'Cebolla', pluralName: 'Cebollas' },
        ],
        nutritionalFacts: { calories: 40 },
      };

      mockSingle.mockResolvedValue({
        data: { id: 'new-ing-1' },
        error: null,
      });
      // Second insert call (translations) resolves successfully
      mockInsert.mockReturnValueOnce({ select: mockSelect })
        .mockResolvedValueOnce({ error: null });

      const result = await service.createIngredient(newIngredient);

      // First call: insert into ingredients (non-translatable fields only)
      expect(mockFrom).toHaveBeenCalledWith('ingredients');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          image_url: '',
        })
      );
      // Should NOT contain legacy column-per-language fields
      expect(mockInsert).toHaveBeenCalledWith(
        expect.not.objectContaining({
          name_en: expect.anything(),
          name_es: expect.anything(),
        })
      );

      // Second call: insert translations
      expect(mockFrom).toHaveBeenCalledWith('ingredient_translations');
      expect(mockInsert).toHaveBeenCalledWith([
        { ingredient_id: 'new-ing-1', locale: 'en', name: 'Onion', plural_name: 'Onions' },
        { ingredient_id: 'new-ing-1', locale: 'es', name: 'Cebolla', plural_name: 'Cebollas' },
      ]);
    });

    it('creates ingredient with image upload', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const newIngredient = {
        translations: [
          { locale: 'en', name: 'Carrot' },
          { locale: 'es', name: 'Zanahoria' },
        ],
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/carrot.png');
      mockSingle.mockResolvedValue({
        data: { id: 'new-ing-2' },
        error: null,
      });
      mockInsert.mockReturnValueOnce({ select: mockSelect })
        .mockResolvedValueOnce({ error: null });

      await service.createIngredient(newIngredient);

      expect(mockUploadImage).toHaveBeenCalledWith({
        bucket: 'ingredients',
        folderPath: 'images',
        fileName: 'Zanahoria.png',
        file: mockFile,
        forcePNG: true,
      });
    });
  });

  // ============================================================
  // UPDATE INGREDIENT TESTS
  // ============================================================

  describe('updateIngredient', () => {
    it('updates ingredient name fields via translation upsert', async () => {
      const updates = {
        id: 'ing-1',
        translations: [
          { locale: 'en', name: 'Updated Tomato' },
          { locale: 'es', name: 'Tomate Actualizado' },
        ],
      };

      await service.updateIngredient('ing-1', updates as any);

      // Name fields should NOT go to the ingredients table update
      expect(mockUpdate).not.toHaveBeenCalled();

      // Should upsert translations
      expect(mockFrom).toHaveBeenCalledWith('ingredient_translations');
      expect(mockUpsert).toHaveBeenCalledWith(
        [
          { ingredient_id: 'ing-1', locale: 'en', name: 'Updated Tomato', plural_name: null },
          { ingredient_id: 'ing-1', locale: 'es', name: 'Tomate Actualizado', plural_name: null },
        ],
        { onConflict: 'ingredient_id,locale' }
      );
    });

    it('updates ingredient with new image', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const updates = {
        id: 'ing-1',
        translations: [
          { locale: 'en', name: 'Tomato' },
        ],
        pictureUrl: mockFile as any,
      };

      mockEq.mockReturnValue({
        single: mockSingle,
        select: jest.fn().mockReturnValue({ single: mockSingle }),
      });
      mockSingle.mockResolvedValue({
        data: { image_url: 'https://example.com/old-tomato.png' },
        error: null,
      });
      mockUploadImage.mockResolvedValue('https://example.com/new-tomato.png');
      mockDeleteImage.mockResolvedValue(undefined);

      await service.updateIngredient('ing-1', updates);

      expect(mockDeleteImage).toHaveBeenCalledWith('https://example.com/old-tomato.png');
      expect(mockUploadImage).toHaveBeenCalled();
    });

    it('returns original ingredient when no changes', async () => {
      const ingredient = { id: 'ing-1' };

      const result = await service.updateIngredient('ing-1', ingredient);

      expect(result).toEqual(ingredient);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('continues update even if old image deletion fails', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const updates = {
        id: 'ing-1',
        pictureUrl: mockFile as any,
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockEq.mockReturnValue({
        single: mockSingle,
        select: jest.fn().mockReturnValue({ single: mockSingle }),
      });
      mockSingle.mockResolvedValue({
        data: { image_url: 'https://example.com/old.png' },
        error: null,
      });
      mockDeleteImage.mockRejectedValue(new Error('Delete failed'));
      mockUploadImage.mockResolvedValue('https://example.com/new.png');

      await service.updateIngredient('ing-1', updates);

      expect(mockUploadImage).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // DELETE INGREDIENT TESTS
  // ============================================================

  describe('deleteIngredient', () => {
    it('deletes ingredient by id', async () => {
      mockEq.mockResolvedValue({ error: null });

      await service.deleteIngredient('ing-1');

      expect(mockFrom).toHaveBeenCalledWith('ingredients');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'ing-1');
    });

    it('throws error for invalid id', async () => {
      await expect(service.deleteIngredient('')).rejects.toThrow(
        'Invalid ingredient ID provided'
      );
      await expect(service.deleteIngredient(null as any)).rejects.toThrow(
        'Invalid ingredient ID provided'
      );
    });

    it('throws error when delete fails', async () => {
      mockEq.mockResolvedValue({ error: { message: 'Delete failed' } });

      await expect(service.deleteIngredient('ing-1')).rejects.toThrow(
        'Error deleting ingredient: Delete failed'
      );
    });
  });

  // ============================================================
  // IMAGE HANDLING TESTS
  // ============================================================

  describe('image handling', () => {
    it('uses Spanish name for image filename when available', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const newIngredient = {
        translations: [
          { locale: 'en', name: 'Pepper' },
          { locale: 'es', name: 'Pimiento' },
        ],
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/pimiento.png');
      mockSingle.mockResolvedValue({ data: { id: 'new-ing' }, error: null });
      mockInsert.mockReturnValueOnce({ select: mockSelect })
        .mockResolvedValueOnce({ error: null });

      await service.createIngredient(newIngredient);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'Pimiento.png',
        })
      );
    });

    it('falls back to English name for filename', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const newIngredient = {
        translations: [
          { locale: 'en', name: 'Pepper' },
        ],
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/pepper.png');
      mockSingle.mockResolvedValue({ data: { id: 'new-ing' }, error: null });
      mockInsert.mockReturnValueOnce({ select: mockSelect })
        .mockResolvedValueOnce({ error: null });

      await service.createIngredient(newIngredient);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'Pepper.png',
        })
      );
    });
  });
});

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
    name_en: 'Tomato',
    name_es: 'Tomate',
    plural_name_en: 'Tomatoes',
    plural_name_es: 'Tomates',
    picture_url: 'https://example.com/tomato.png',
    nutritional_facts: { calories: 20 },
  };

  const mockTransformedIngredient = {
    id: 'ing-1',
    nameEn: 'Tomato',
    nameEs: 'Tomate',
    pluralNameEn: 'Tomatoes',
    pluralNameEs: 'Tomates',
    pictureUrl: 'https://example.com/tomato.png',
    nutritionalFacts: { calories: 20 },
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
    });
    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
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
  });

  // ============================================================
  // GET ALL INGREDIENTS TESTS
  // ============================================================

  describe('getAllIngredientsForAdmin', () => {
    it('fetches all ingredients with default sort', async () => {
      const result = await service.getAllIngredientsForAdmin();

      expect(mockFrom).toHaveBeenCalledWith('ingredients');
      expect(mockOrder).toHaveBeenCalledWith('name_en', { ascending: true });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockTransformedIngredient);
    });

    it('fetches ingredients sorted by Spanish name', async () => {
      await service.getAllIngredientsForAdmin('name_es');

      expect(mockOrder).toHaveBeenCalledWith('name_es', { ascending: true });
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

    it('transforms undefined names to undefined', async () => {
      mockOrder.mockResolvedValue({
        data: [{ id: 'ing-2', name_en: null, name_es: null }],
        error: null,
      });

      const result = await service.getAllIngredientsForAdmin();

      expect(result[0].nameEn).toBeUndefined();
      expect(result[0].nameEs).toBeUndefined();
    });
  });

  // ============================================================
  // CREATE INGREDIENT TESTS
  // ============================================================

  describe('createIngredient', () => {
    it('creates ingredient without image', async () => {
      const newIngredient = {
        nameEn: 'Onion',
        nameEs: 'Cebolla',
        pluralNameEn: 'Onions',
        pluralNameEs: 'Cebollas',
        nutritionalFacts: { calories: 40 },
      };

      mockSelect.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue({
        data: { ...mockIngredient, name_en: 'Onion' },
        error: null,
      });

      await service.createIngredient(newIngredient);

      expect(mockFrom).toHaveBeenCalledWith('ingredients');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name_en: 'Onion',
          name_es: 'Cebolla',
          plural_name_en: 'Onions',
          plural_name_es: 'Cebollas',
          picture_url: '',
        })
      );
    });

    it('creates ingredient with image upload', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const newIngredient = {
        nameEn: 'Carrot',
        nameEs: 'Zanahoria',
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/carrot.png');
      mockSelect.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue({
        data: { ...mockIngredient, name_en: 'Carrot' },
        error: null,
      });

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
    it('updates ingredient name fields', async () => {
      const updates = {
        id: 'ing-1',
        nameEn: 'Updated Tomato',
        nameEs: 'Tomate Actualizado',
      };

      // Mock for fetching current ingredient (no image change)
      mockEq.mockReturnValue({
        single: mockSingle,
        select: jest.fn().mockReturnValue({ single: mockSingle }),
      });
      mockSingle.mockResolvedValue({
        data: { picture_url: 'https://example.com/tomato.png' },
        error: null,
      });

      await service.updateIngredient('ing-1', updates);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name_en: 'Updated Tomato',
          name_es: 'Tomate Actualizado',
        })
      );
    });

    it('updates ingredient with new image', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const updates = {
        id: 'ing-1',
        nameEn: 'Tomato',
        pictureUrl: mockFile as any,
      };

      mockEq.mockReturnValue({
        single: mockSingle,
        select: jest.fn().mockReturnValue({ single: mockSingle }),
      });
      mockSingle.mockResolvedValue({
        data: { picture_url: 'https://example.com/old-tomato.png' },
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
        data: { picture_url: 'https://example.com/old.png' },
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
        nameEn: 'Pepper',
        nameEs: 'Pimiento',
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/pimiento.png');
      mockSelect.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue({ data: mockIngredient, error: null });

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
        nameEn: 'Pepper',
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/pepper.png');
      mockSelect.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue({ data: mockIngredient, error: null });

      await service.createIngredient(newIngredient);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'Pepper.png',
        })
      );
    });
  });
});

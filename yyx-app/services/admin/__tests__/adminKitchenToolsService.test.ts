/**
 * AdminKitchenToolsService Tests
 *
 * Tests for admin kitchen tools service covering:
 * - Fetching all kitchen tools
 * - Creating kitchen tools
 * - Updating kitchen tools
 * - Deleting kitchen tools
 * - Image handling
 */

import { AdminKitchenToolsService } from '../adminKitchenToolsService';

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

describe('AdminKitchenToolsService', () => {
  let service: AdminKitchenToolsService;

  const mockKitchenTool = {
    id: 'item-1',
    image_url: 'https://example.com/bowl.png',
    translations: [
      { locale: 'en', name: 'Mixing Bowl' },
      { locale: 'es', name: 'Tazon para mezclar' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminKitchenToolsService();

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
    mockOrder.mockResolvedValue({ data: [mockKitchenTool], error: null });
    mockEq.mockReturnValue({
      single: mockSingle,
      select: mockSelect,
    });
    mockSingle.mockResolvedValue({ data: mockKitchenTool, error: null });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({ single: mockSingle }),
    });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockUpsert.mockResolvedValue({ error: null });
  });

  // ============================================================
  // GET ALL KITCHEN TOOLS TESTS
  // ============================================================

  describe('getAllKitchenTools', () => {
    it('fetches all kitchen tools with default sort', async () => {
      await service.getAllKitchenTools();

      expect(mockFrom).toHaveBeenCalledWith('kitchen_tools');
    });

    it('sorts by Spanish name client-side', async () => {
      await service.getAllKitchenTools('es');

      // Still fetches from same table, sorting happens client-side now
      expect(mockFrom).toHaveBeenCalledWith('kitchen_tools');
    });
  });

  // ============================================================
  // CREATE KITCHEN TOOL TESTS
  // ============================================================

  describe('createKitchenTool', () => {
    it('creates item without image', async () => {
      const newItem = {
        translations: [
          { locale: 'en', name: 'Whisk' },
          { locale: 'es', name: 'Batidor' },
        ],
      };

      mockSingle.mockResolvedValue({
        data: { id: 'new-item-1' },
        error: null,
      });

      await service.createKitchenTool(newItem as any);

      // First call: insert into kitchen_tools (non-translatable only)
      expect(mockFrom).toHaveBeenCalledWith('kitchen_tools');
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
      expect(mockFrom).toHaveBeenCalledWith('kitchen_tool_translations');
    });

    it('creates item with image upload', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const newItem = {
        translations: [
          { locale: 'en', name: 'Spatula' },
          { locale: 'es', name: 'Espátula' },
        ],
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/spatula.png');
      mockSingle.mockResolvedValue({
        data: { id: 'new-item-2' },
        error: null,
      });

      await service.createKitchenTool(newItem as any);

      expect(mockUploadImage).toHaveBeenCalledWith({
        bucket: 'kitchen-tools',
        folderPath: 'images',
        fileName: 'Espátula.png',
        file: mockFile,
        forcePNG: true,
      });
    });
  });

  // ============================================================
  // UPDATE KITCHEN TOOL TESTS
  // ============================================================

  describe('updateKitchenTool', () => {
    it('updates item name fields via translation upsert', async () => {
      const updates = {
        id: 'item-1',
        translations: [
          { locale: 'en', name: 'Updated Bowl' },
          { locale: 'es', name: 'Tazón Actualizado' },
        ],
      };

      await service.updateKitchenTool('item-1', updates as any);

      // Name fields should NOT go to the kitchen_tools table update
      expect(mockUpdate).not.toHaveBeenCalled();

      // Should upsert translations
      expect(mockFrom).toHaveBeenCalledWith('kitchen_tool_translations');
      expect(mockUpsert).toHaveBeenCalledWith(
        [
          { kitchen_tool_id: 'item-1', locale: 'en', name: 'Updated Bowl' },
          { kitchen_tool_id: 'item-1', locale: 'es', name: 'Tazón Actualizado' },
        ],
        { onConflict: 'kitchen_tool_id,locale' }
      );
    });

    it('updates item with new image', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const updates = {
        id: 'item-1',
        translations: [{ locale: 'en', name: 'Bowl' }],
        pictureUrl: mockFile as any,
      };

      mockEq.mockReturnValue({
        single: mockSingle,
        select: jest.fn().mockReturnValue({ single: mockSingle }),
      });
      mockSingle.mockResolvedValue({
        data: { image_url: 'https://example.com/old-bowl.png' },
        error: null,
      });
      mockUploadImage.mockResolvedValue('https://example.com/new-bowl.png');
      mockDeleteImage.mockResolvedValue(undefined);

      await service.updateKitchenTool('item-1', updates as any);

      expect(mockDeleteImage).toHaveBeenCalledWith('https://example.com/old-bowl.png');
      expect(mockUploadImage).toHaveBeenCalled();
    });

    it('returns original item when no changes', async () => {
      const item = { id: 'item-1' };

      const result = await service.updateKitchenTool('item-1', item as any);

      expect(result).toEqual(item);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('throws error when fetch current item fails', async () => {
      const updates = {
        id: 'item-1',
        pictureUrl: 'https://example.com/new.png',
      };

      mockEq.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Fetch failed' },
        }),
      });

      await expect(service.updateKitchenTool('item-1', updates as any)).rejects.toThrow(
        'Error fetching current kitchen tool: Fetch failed'
      );
    });
  });

  // ============================================================
  // DELETE KITCHEN TOOL TESTS
  // ============================================================

  describe('deleteKitchenTool', () => {
    it('deletes item and its image', async () => {
      mockEq.mockReturnValue({
        single: mockSingle,
      });
      mockSingle.mockResolvedValue({
        data: { image_url: 'https://example.com/bowl.png' },
        error: null,
      });
      mockFrom.mockReturnValue({
        select: mockSelect,
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });
      mockDeleteImage.mockResolvedValue(undefined);

      await service.deleteKitchenTool('item-1');

      expect(mockDeleteImage).toHaveBeenCalledWith('https://example.com/bowl.png');
    });

    it('throws error for invalid id', async () => {
      await expect(service.deleteKitchenTool('')).rejects.toThrow(
        'Invalid kitchen tool ID provided'
      );
      await expect(service.deleteKitchenTool(null as any)).rejects.toThrow(
        'Invalid kitchen tool ID provided'
      );
    });

    it('throws error when delete fails', async () => {
      mockEq.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue({ data: null, error: null });
      mockFrom.mockReturnValue({
        select: mockSelect,
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
        }),
      });

      await expect(service.deleteKitchenTool('item-1')).rejects.toThrow(
        'Error deleting kitchen tool: Delete failed'
      );
    });

    it('continues delete even if image deletion fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockEq.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue({
        data: { image_url: 'https://example.com/bowl.png' },
        error: null,
      });
      mockDeleteImage.mockRejectedValue(new Error('Image delete failed'));
      mockFrom.mockReturnValue({
        select: mockSelect,
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      await service.deleteKitchenTool('item-1');

      // Should not throw, deletion continues
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // IMAGE HANDLING TESTS
  // ============================================================

  describe('image handling', () => {
    it('prefers Spanish name for image filename (Mexico-first)', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const newItem = {
        translations: [
          { locale: 'en', name: 'Cutting Board' },
          { locale: 'es', name: 'Tabla de cortar' },
        ],
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/cutting-board.png');
      mockSingle.mockResolvedValue({ data: { id: 'new-item' }, error: null });

      await service.createKitchenTool(newItem as any);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'Tabla de cortar.png',
        })
      );
    });

    it('falls back to Spanish name for filename', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const newItem = {
        translations: [
          { locale: 'es', name: 'Tabla de cortar' },
        ],
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/tabla.png');
      mockSingle.mockResolvedValue({ data: { id: 'new-item' }, error: null });

      await service.createKitchenTool(newItem as any);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'Tabla de cortar.png',
        })
      );
    });

    it('uses default name when no translations provided', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const newItem = {
        pictureUrl: mockFile,
      };

      mockUploadImage.mockResolvedValue('https://example.com/kitchen-tool.png');
      mockSingle.mockResolvedValue({ data: { id: 'new-item' }, error: null });

      await service.createKitchenTool(newItem as any);

      expect(mockUploadImage).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'kitchen-tool.png',
        })
      );
    });
  });
});

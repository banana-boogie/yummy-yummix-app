/**
 * AdminContentHealthService Tests
 *
 * Tests for the content health service covering RPC calls and publish delegation.
 */

import { adminContentHealthService } from '../adminContentHealthService';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

// Mock adminRecipeService
const mockTogglePublished = jest.fn();
jest.mock('@/services/admin/adminRecipeService', () => ({
  adminRecipeService: {
    toggleRecipePublished: (...args: any[]) => mockTogglePublished(...args),
  },
}));

const mockHealthData = {
  summary: {
    missingTranslations: { total: 10, recipes: 3, ingredients: 5, usefulItems: 2 },
    missingImages: { total: 8, recipes: 4, ingredients: 3, usefulItems: 1 },
    missingNutrition: { total: 5, ingredients: 5 },
    unpublished: { total: 20, recipes: 20 },
  },
  issues: [
    {
      id: 'recipe-1',
      entityType: 'recipe',
      name: 'Pasta Carbonara',
      imageUrl: null,
      isPublished: false,
      stepCount: 5,
      ingredientCount: 8,
      missingEn: false,
      missingEs: true,
      missingImage: true,
      missingNutrition: false,
    },
  ],
};

describe('AdminContentHealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getContentHealth', () => {
    it('calls admin_content_health RPC and returns data', async () => {
      mockRpc.mockResolvedValue({ data: mockHealthData, error: null });

      const result = await adminContentHealthService.getContentHealth();

      expect(mockRpc).toHaveBeenCalledWith('admin_content_health');
      expect(result).toEqual(mockHealthData);
    });

    it('throws error when RPC fails', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      await expect(adminContentHealthService.getContentHealth()).rejects.toThrow(
        'Failed to fetch content health: RPC error'
      );
    });
  });

  describe('publishRecipe', () => {
    it('delegates to adminRecipeService.toggleRecipePublished with true', async () => {
      mockTogglePublished.mockResolvedValue(undefined);

      await adminContentHealthService.publishRecipe('recipe-1');

      expect(mockTogglePublished).toHaveBeenCalledWith('recipe-1', true);
    });

    it('propagates errors from toggleRecipePublished', async () => {
      mockTogglePublished.mockRejectedValue(new Error('Publish failed'));

      await expect(adminContentHealthService.publishRecipe('recipe-1')).rejects.toThrow(
        'Publish failed'
      );
    });
  });
});

/**
 * customRecipeService Tests
 *
 * Tests for saving, loading, listing, and deleting custom recipes.
 */

import { customRecipeService } from '../customRecipeService';
import { createMockGeneratedRecipe } from '@/test/mocks/chat';
import {
  getMockSupabaseClient,
  mockSupabaseAuthSuccess,
  mockSupabaseAuthError,
} from '@/test/mocks/supabase';

describe('customRecipeService', () => {
  const mockClient = getMockSupabaseClient();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // save() Tests
  // ============================================================

  describe('save', () => {
    it('saves recipe and returns id', async () => {
      const mockUser = mockSupabaseAuthSuccess().user;
      const recipe = createMockGeneratedRecipe();

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'recipe-456' },
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const result = await customRecipeService.save(recipe, 'My Recipe');

      expect(result.userRecipeId).toBe('recipe-456');
      expect(mockClient.from).toHaveBeenCalledWith('user_recipes');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          name: 'My Recipe',
          source: 'ai_generated',
        })
      );
    });

    it('includes correct schema version in recipe_data', async () => {
      mockSupabaseAuthSuccess();
      const recipe = createMockGeneratedRecipe();

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'recipe-456' },
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await customRecipeService.save(recipe, 'My Recipe');

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          recipe_data: expect.objectContaining({
            schemaVersion: '1.0',
          }),
        })
      );
    });

    it('sets source to ai_generated', async () => {
      mockSupabaseAuthSuccess();
      const recipe = createMockGeneratedRecipe();

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'recipe-456' },
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await customRecipeService.save(recipe, 'My Recipe');

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'ai_generated',
        })
      );
    });

    it('throws on auth error', async () => {
      mockSupabaseAuthError('Not authenticated');
      const recipe = createMockGeneratedRecipe();

      await expect(
        customRecipeService.save(recipe, 'My Recipe')
      ).rejects.toThrow('User not authenticated');
    });

    it('throws on insert error', async () => {
      mockSupabaseAuthSuccess();
      const recipe = createMockGeneratedRecipe();

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error', code: 'PGRST116' },
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await expect(
        customRecipeService.save(recipe, 'My Recipe')
      ).rejects.toThrow('Failed to save recipe');
    });

    it('includes all recipe data in the saved record', async () => {
      mockSupabaseAuthSuccess();
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Chicken Stir Fry',
        totalTime: 30,
        difficulty: 'easy',
        portions: 4,
      });

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'recipe-456' },
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await customRecipeService.save(recipe, 'Custom Name');

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          recipe_data: expect.objectContaining({
            suggestedName: 'Chicken Stir Fry',
            totalTime: 30,
            difficulty: 'easy',
            portions: 4,
          }),
        })
      );
    });
  });

  // ============================================================
  // load() Tests
  // ============================================================

  describe('load', () => {
    it('loads and parses recipe_data', async () => {
      const mockUser = mockSupabaseAuthSuccess().user;
      const recipe = createMockGeneratedRecipe();

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'recipe-123',
            name: 'My Recipe',
            recipe_data: recipe,
            source: 'ai_generated',
            created_at: '2024-01-15T12:00:00Z',
          },
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const result = await customRecipeService.load('recipe-123');

      expect(result.id).toBe('recipe-123');
      expect(result.name).toBe('My Recipe');
      expect(result.recipe).toEqual(recipe);
      expect(result.source).toBe('ai_generated');
      expect(result.createdAt).toBe('2024-01-15T12:00:00Z');
    });

    it('throws when recipe not found', async () => {
      mockSupabaseAuthSuccess();

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await expect(customRecipeService.load('nonexistent-id')).rejects.toThrow(
        'Failed to load recipe'
      );
    });

    it('throws on auth error', async () => {
      mockSupabaseAuthError('Not authenticated');

      await expect(customRecipeService.load('recipe-123')).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('validates user ownership with user_id filter', async () => {
      const mockUser = mockSupabaseAuthSuccess().user;

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'recipe-123',
            name: 'My Recipe',
            recipe_data: createMockGeneratedRecipe(),
            source: 'ai_generated',
            created_at: '2024-01-15T12:00:00Z',
          },
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await customRecipeService.load('recipe-123');

      // Verify eq was called with both id and user_id
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'recipe-123');
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });
  });

  // ============================================================
  // list() Tests
  // ============================================================

  describe('list', () => {
    it("returns user's recipes ordered by created_at desc", async () => {
      const mockUser = mockSupabaseAuthSuccess().user;
      const recipe1 = createMockGeneratedRecipe({ totalTime: 30, difficulty: 'easy' });
      const recipe2 = createMockGeneratedRecipe({ totalTime: 45, difficulty: 'medium' });

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'recipe-1',
              name: 'Recipe 1',
              source: 'ai_generated',
              created_at: '2024-01-16T12:00:00Z',
              recipe_data: recipe1,
            },
            {
              id: 'recipe-2',
              name: 'Recipe 2',
              source: 'ai_modified',
              created_at: '2024-01-15T12:00:00Z',
              recipe_data: recipe2,
            },
          ],
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const result = await customRecipeService.list();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('recipe-1');
      expect(result[0].name).toBe('Recipe 1');
      expect(result[0].source).toBe('ai_generated');
      expect(result[0].totalTime).toBe(30);
      expect(result[0].difficulty).toBe('easy');
      expect(result[1].id).toBe('recipe-2');
      expect(result[1].totalTime).toBe(45);
      expect(result[1].difficulty).toBe('medium');
    });

    it('limits to 50 results', async () => {
      mockSupabaseAuthSuccess();

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await customRecipeService.list();

      expect(mockChain.limit).toHaveBeenCalledWith(50);
    });

    it('orders by created_at descending', async () => {
      mockSupabaseAuthSuccess();

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await customRecipeService.list();

      expect(mockChain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('throws on auth error', async () => {
      mockSupabaseAuthError('Not authenticated');

      await expect(customRecipeService.list()).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('filters by user_id', async () => {
      const mockUser = mockSupabaseAuthSuccess().user;

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await customRecipeService.list();

      expect(mockChain.eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('handles null recipe_data gracefully', async () => {
      mockSupabaseAuthSuccess();

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'recipe-1',
              name: 'Recipe 1',
              source: 'ai_generated',
              created_at: '2024-01-16T12:00:00Z',
              recipe_data: null,
            },
          ],
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const result = await customRecipeService.list();

      expect(result[0].totalTime).toBeUndefined();
      expect(result[0].difficulty).toBeUndefined();
    });
  });

  // ============================================================
  // delete() Tests
  // ============================================================

  describe('delete', () => {
    it('deletes recipe by id', async () => {
      const mockUser = mockSupabaseAuthSuccess().user;

      const mockChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      // Make the final eq call resolve the promise
      mockChain.eq.mockImplementation(() => {
        return {
          ...mockChain,
          then: (resolve: (value: { error: null }) => void) =>
            resolve({ error: null }),
        };
      });
      mockClient.from.mockReturnValue(mockChain);

      await customRecipeService.delete('recipe-123');

      expect(mockClient.from).toHaveBeenCalledWith('user_recipes');
      expect(mockChain.delete).toHaveBeenCalled();
    });

    it('throws on auth error', async () => {
      mockSupabaseAuthError('Not authenticated');

      await expect(customRecipeService.delete('recipe-123')).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('validates user ownership with both id and user_id', async () => {
      const mockUser = mockSupabaseAuthSuccess().user;
      const eqCalls: string[][] = [];

      const mockChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((field: string, value: string) => {
          eqCalls.push([field, value]);
          return {
            ...mockChain,
            then: (resolve: (value: { error: null }) => void) =>
              resolve({ error: null }),
          };
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await customRecipeService.delete('recipe-123');

      expect(eqCalls).toContainEqual(['id', 'recipe-123']);
      expect(eqCalls).toContainEqual(['user_id', mockUser.id]);
    });

    it('throws on delete error', async () => {
      mockSupabaseAuthSuccess();

      const mockChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation(() => {
          return {
            ...mockChain,
            then: (resolve: (value: { error: { message: string } }) => void) =>
              resolve({ error: { message: 'Delete failed' } }),
          };
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await expect(customRecipeService.delete('recipe-123')).rejects.toThrow(
        'Failed to delete recipe'
      );
    });
  });
});

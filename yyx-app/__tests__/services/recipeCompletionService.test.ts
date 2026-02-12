import { recipeCompletionService } from '@/services/recipeCompletionService';
import { validateRecipeIsPublished } from '@/services/recipeValidation';
import { supabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// Mock shared validation
jest.mock('@/services/recipeValidation', () => ({
  validateRecipeIsPublished: jest.fn(),
}));

describe('recipeCompletionService', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockRecipeId = 'recipe-456';

  beforeEach(() => {
    jest.clearAllMocks();
    (validateRecipeIsPublished as jest.Mock).mockResolvedValue(undefined);
  });

  describe('recordCompletion', () => {
    it('should insert a new completion event', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await recipeCompletionService.recordCompletion(mockRecipeId);

      expect(validateRecipeIsPublished).toHaveBeenCalledWith(mockRecipeId);
      expect(mockFrom.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          recipe_id: mockRecipeId,
          completed_at: expect.any(String),
        })
      );
    });

    it('should silently skip for unauthenticated users', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      await recipeCompletionService.recordCompletion(mockRecipeId);

      expect(validateRecipeIsPublished).not.toHaveBeenCalled();
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should throw when insert fails', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        insert: jest.fn().mockResolvedValue({
          error: { message: 'insert failed' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(recipeCompletionService.recordCompletion(mockRecipeId)).rejects.toThrow(
        'Failed to record recipe completion. Please try again.'
      );
    });

    it('should support concurrent completion inserts without update fallback logic', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await Promise.all([
        recipeCompletionService.recordCompletion(mockRecipeId),
        recipeCompletionService.recordCompletion(mockRecipeId),
      ]);

      expect(mockFrom.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasCompletedRecipe', () => {
    it('should return true when completion exists', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'comp-1' },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await recipeCompletionService.hasCompletedRecipe(mockRecipeId);
      expect(result).toBe(true);
    });

    it('should return false when no completion exists', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await recipeCompletionService.hasCompletedRecipe(mockRecipeId);
      expect(result).toBe(false);
    });

    it('should return false for unauthenticated users', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const result = await recipeCompletionService.hasCompletedRecipe(mockRecipeId);
      expect(result).toBe(false);
    });

    it('should throw when completion status query fails', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '42501' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(recipeCompletionService.hasCompletedRecipe(mockRecipeId)).rejects.toThrow(
        'Failed to check recipe completion status. Please try again.'
      );
    });
  });

  describe('getCompletionCount', () => {
    it('should return completion count', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      mockFrom.eq
        .mockReturnValueOnce(mockFrom)
        .mockResolvedValueOnce({
          data: null,
          count: 5,
          error: null,
        });

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const count = await recipeCompletionService.getCompletionCount(mockRecipeId);
      expect(count).toBe(5);
    });

    it('should return 0 when no completion exists', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      mockFrom.eq
        .mockReturnValueOnce(mockFrom)
        .mockResolvedValueOnce({
          data: null,
          count: 0,
          error: null,
        });

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const count = await recipeCompletionService.getCompletionCount(mockRecipeId);
      expect(count).toBe(0);
    });

    it('should return 0 for unauthenticated users', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const count = await recipeCompletionService.getCompletionCount(mockRecipeId);
      expect(count).toBe(0);
    });

    it('should throw on count query error', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      mockFrom.eq
        .mockReturnValueOnce(mockFrom)
        .mockResolvedValueOnce({
          data: null,
          count: null,
          error: { message: 'DB error' },
        });

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(recipeCompletionService.getCompletionCount(mockRecipeId)).rejects.toThrow(
        'Failed to fetch recipe completion count. Please try again.'
      );
    });
  });
});

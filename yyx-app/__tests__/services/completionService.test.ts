import { completionService } from '@/services/completionService';
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

describe('completionService', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockRecipeId = 'recipe-456';

  beforeEach(() => {
    jest.clearAllMocks();
    (validateRecipeIsPublished as jest.Mock).mockResolvedValue(undefined);
  });

  describe('recordCompletion', () => {
    it('should insert a new completion for first-time completion', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // No rows found
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
        // For user_events fire-and-forget
        then: jest.fn().mockImplementation((cb) => { cb?.(); return Promise.resolve(); }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await completionService.recordCompletion(mockRecipeId);

      expect(validateRecipeIsPublished).toHaveBeenCalledWith(mockRecipeId);
      expect(mockFrom.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          recipe_id: mockRecipeId,
          completion_count: 1,
        })
      );
    });

    it('should update existing completion', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'comp-1', completion_count: 2 },
          error: null,
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
        then: jest.fn().mockImplementation((cb) => { cb?.(); return Promise.resolve(); }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await completionService.recordCompletion(mockRecipeId);

      expect(mockFrom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          completion_count: 3,
        })
      );
    });

    it('should handle race condition (23505 unique violation)', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      let selectCallCount = 0;
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // First call: no existing record
            return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
          }
          // Second call (retry after 23505): record exists now
          return Promise.resolve({ data: { id: 'comp-1', completion_count: 1 }, error: null });
        }),
        insert: jest.fn().mockResolvedValue({
          error: { code: '23505', message: 'unique violation' },
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        then: jest.fn().mockImplementation((cb) => { cb?.(); return Promise.resolve(); }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await completionService.recordCompletion(mockRecipeId);

      // Should have retried with update
      expect(mockFrom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          completion_count: 2,
        })
      );
    });

    it('should silently skip for unauthenticated users', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      await completionService.recordCompletion(mockRecipeId);

      expect(validateRecipeIsPublished).not.toHaveBeenCalled();
      expect(supabase.from).not.toHaveBeenCalled();
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

      const result = await completionService.hasCompletedRecipe(mockRecipeId);
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

      const result = await completionService.hasCompletedRecipe(mockRecipeId);
      expect(result).toBe(false);
    });

    it('should return false for unauthenticated users', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const result = await completionService.hasCompletedRecipe(mockRecipeId);
      expect(result).toBe(false);
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
        single: jest.fn().mockResolvedValue({
          data: { completion_count: 5 },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const count = await completionService.getCompletionCount(mockRecipeId);
      expect(count).toBe(5);
    });

    it('should return 0 when no completion exists', async () => {
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

      const count = await completionService.getCompletionCount(mockRecipeId);
      expect(count).toBe(0);
    });

    it('should return 0 for unauthenticated users', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const count = await completionService.getCompletionCount(mockRecipeId);
      expect(count).toBe(0);
    });
  });
});

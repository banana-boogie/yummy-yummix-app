import { ratingService } from '@/services/ratingService';
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

describe('ratingService', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockRecipeId = 'recipe-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRecipe', () => {
    it('should validate a published recipe successfully', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockRecipeId, status: 'published' },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(ratingService.validateRecipe(mockRecipeId)).resolves.not.toThrow();
    });

    it('should throw error if recipe not found', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(ratingService.validateRecipe(mockRecipeId)).rejects.toThrow('Recipe not found');
    });

    it('should throw error if recipe is not published', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockRecipeId, status: 'draft' },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(ratingService.validateRecipe(mockRecipeId)).rejects.toThrow(
        'Recipe is not available for rating'
      );
    });
  });

  describe('submitRating', () => {
    it('should submit a valid rating successfully', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockRecipeId, status: 'published' },
          error: null,
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(ratingService.submitRating(mockRecipeId, 4)).resolves.not.toThrow();

      expect(mockFrom.upsert).toHaveBeenCalledWith(
        {
          user_id: mockUser.id,
          recipe_id: mockRecipeId,
          rating: 4,
        },
        {
          onConflict: 'user_id,recipe_id',
        }
      );
    });

    it('should throw error if user is not logged in', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      await expect(ratingService.submitRating(mockRecipeId, 4)).rejects.toThrow(
        'User must be logged in to rate recipes'
      );
    });

    it('should throw error if rating is less than 1', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      await expect(ratingService.submitRating(mockRecipeId, 0)).rejects.toThrow(
        'Rating must be a whole number between 1 and 5'
      );
    });

    it('should throw error if rating is greater than 5', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      await expect(ratingService.submitRating(mockRecipeId, 6)).rejects.toThrow(
        'Rating must be a whole number between 1 and 5'
      );
    });

    it('should throw error if rating is not an integer', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      await expect(ratingService.submitRating(mockRecipeId, 3.5)).rejects.toThrow(
        'Rating must be a whole number between 1 and 5'
      );
    });
  });

  describe('submitFeedback', () => {
    it('should submit valid feedback successfully', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockRecipeId, status: 'published' },
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const feedback = 'This recipe was amazing!';
      await expect(ratingService.submitFeedback(mockRecipeId, feedback)).resolves.not.toThrow();

      expect(mockFrom.insert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        recipe_id: mockRecipeId,
        feedback: feedback,
      });
    });

    it('should throw error if user is not logged in', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      await expect(ratingService.submitFeedback(mockRecipeId, 'Great!')).rejects.toThrow(
        'User must be logged in to submit feedback'
      );
    });

    it('should throw error if feedback is empty after trimming', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      await expect(ratingService.submitFeedback(mockRecipeId, '   ')).rejects.toThrow(
        'Feedback must be between 1 and 2000 characters'
      );
    });

    it('should throw error if feedback exceeds 2000 characters', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const longFeedback = 'a'.repeat(2001);
      await expect(ratingService.submitFeedback(mockRecipeId, longFeedback)).rejects.toThrow(
        'Feedback must be between 1 and 2000 characters'
      );
    });

    it('should trim feedback before submission', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockRecipeId, status: 'published' },
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await ratingService.submitFeedback(mockRecipeId, '  Great recipe!  ');

      expect(mockFrom.insert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        recipe_id: mockRecipeId,
        feedback: 'Great recipe!',
      });
    });
  });

  describe('getUserRating', () => {
    it('should return user rating if exists', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { rating: 5 },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const rating = await ratingService.getUserRating(mockRecipeId);

      expect(rating).toBe(5);
    });

    it('should return null if user is not logged in', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const rating = await ratingService.getUserRating(mockRecipeId);

      expect(rating).toBeNull();
    });

    it('should return null if no rating found (PGRST116)', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const rating = await ratingService.getUserRating(mockRecipeId);

      expect(rating).toBeNull();
    });
  });

  describe('getRecipeRatingStats', () => {
    it('should return rating statistics', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { average_rating: 4.5, rating_count: 10 },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const stats = await ratingService.getRecipeRatingStats(mockRecipeId);

      expect(stats).toEqual({
        averageRating: 4.5,
        ratingCount: 10,
      });
    });

    it('should return null for averageRating if not set', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { average_rating: null, rating_count: 0 },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const stats = await ratingService.getRecipeRatingStats(mockRecipeId);

      expect(stats).toEqual({
        averageRating: null,
        ratingCount: 0,
      });
    });
  });
});

import { RATING_REQUIRES_COMPLETION_ERROR, ratingService } from '@/services/ratingService';
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

describe('ratingService', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockRecipeId = 'recipe-456';

  beforeEach(() => {
    jest.clearAllMocks();
    (validateRecipeIsPublished as jest.Mock).mockResolvedValue(undefined);
  });

  describe('submitRating', () => {
    it('should submit a valid rating successfully', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        upsert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(ratingService.submitRating(mockRecipeId, 4)).resolves.not.toThrow();

      expect(validateRecipeIsPublished).toHaveBeenCalledWith(mockRecipeId);
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

    it('should throw completion-gated error when blocked by rating policy', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        upsert: jest.fn().mockResolvedValue({
          error: {
            code: '42501',
            message: 'new row violates row-level security policy for table "recipe_ratings"',
          },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(ratingService.submitRating(mockRecipeId, 4)).rejects.toThrow(
        RATING_REQUIRES_COMPLETION_ERROR
      );
    });
  });

  describe('submitFeedback', () => {
    it('should submit valid feedback successfully', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
      });

      const mockFrom = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const feedback = 'This recipe was amazing!';
      await expect(ratingService.submitFeedback(mockRecipeId, feedback)).resolves.not.toThrow();

      expect(validateRecipeIsPublished).toHaveBeenCalledWith(mockRecipeId);
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

  describe('getRatingDistribution', () => {
    it('should return grouped distribution from a single query', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      // Simulate the final resolved value (after select + eq chain)
      mockFrom.eq.mockResolvedValue({
        data: [
          { rating: 5 },
          { rating: 5 },
          { rating: 5 },
          { rating: 4 },
          { rating: 4 },
          { rating: 3 },
          { rating: 1 },
        ],
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ratingService.getRatingDistribution(mockRecipeId);

      expect(result.distribution).toEqual({ 1: 1, 2: 0, 3: 1, 4: 2, 5: 3 });
      expect(result.total).toBe(7);
    });

    it('should return empty distribution when no ratings exist', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      mockFrom.eq.mockResolvedValue({
        data: [],
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await ratingService.getRatingDistribution(mockRecipeId);

      expect(result.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      expect(result.total).toBe(0);
    });

    it('should throw on query error', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      mockFrom.eq.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(ratingService.getRatingDistribution(mockRecipeId)).rejects.toThrow(
        'Failed to get rating distribution: DB error'
      );
    });
  });
});

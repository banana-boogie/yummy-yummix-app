import { adminFeedbackService } from '@/services/admin/adminFeedbackService';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('adminFeedbackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFeedback', () => {
    it('should return transformed admin feedback data from RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: {
          data: [
            {
              id: 'fb-1',
              feedback: 'Loved this recipe',
              created_at: '2026-02-12T10:00:00.000Z',
              user_id: 'user-1',
              recipe_id: 'recipe-1',
              recipe_name: 'Paella',
              user_email: 'test@example.com',
            },
          ],
          count: 1,
          hasMore: false,
        },
        error: null,
      });

      const result = await adminFeedbackService.getFeedback(
        {
          recipeId: 'recipe-1',
          startDate: '2026-02-01T00:00:00.000Z',
          endDate: '2026-02-12T23:59:59.999Z',
          language: 'es',
        },
        2,
        10
      );

      expect(supabase.rpc).toHaveBeenCalledWith('admin_recipe_feedback_list', {
        p_page: 2,
        p_page_size: 10,
        p_recipe_id: 'recipe-1',
        p_start_date: '2026-02-01T00:00:00.000Z',
        p_end_date: '2026-02-12T23:59:59.999Z',
        p_language: 'es',
      });

      expect(result).toEqual({
        data: [
          {
            id: 'fb-1',
            feedback: 'Loved this recipe',
            createdAt: '2026-02-12T10:00:00.000Z',
            recipeId: 'recipe-1',
            recipeName: 'Paella',
            userId: 'user-1',
            userEmail: 'test@example.com',
          },
        ],
        count: 1,
        hasMore: false,
      });
    });

    it('should throw when RPC returns an error', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Admin access required' },
      });

      await expect(adminFeedbackService.getFeedback()).rejects.toThrow(
        'Failed to fetch feedback: Admin access required'
      );
    });

    it('should fall back to empty result when RPC data is null', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await adminFeedbackService.getFeedback();

      expect(result).toEqual({
        data: [],
        count: 0,
        hasMore: false,
      });
    });
  });
});

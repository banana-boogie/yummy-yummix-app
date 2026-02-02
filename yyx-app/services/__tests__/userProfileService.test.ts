/**
 * userProfileService Tests
 *
 * Tests for user profile service covering:
 * - Profile fetching
 * - Profile updating
 * - Error handling
 * - Data transformation
 *
 * Note: Caching is handled by TanStack Query, not the service layer.
 */

import userProfileService from '../userProfileService';
import { userFactory } from '@/test/factories';

// Mock the supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
    })),
  },
}));

describe('userProfileService', () => {
  const mockProfile = userFactory.createProfile();
  const mockUserId = mockProfile.id;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // FETCH PROFILE TESTS
  // ============================================================

  describe('fetchProfile', () => {
    it('fetches profile from database', async () => {
      const { supabase } = require('@/lib/supabase');
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: mockUserId,
          name: 'Test User',
          email: 'test@example.com',
          is_admin: false,
          onboarding_complete: true,
        },
        error: null,
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      });

      const result = await userProfileService.fetchProfile(mockUserId);

      expect(supabase.from).toHaveBeenCalledWith('user_profiles');
      expect(result).toBeTruthy();
      expect(result.id).toBe(mockUserId);
    });

    it('transforms snake_case to camelCase', async () => {
      const { supabase } = require('@/lib/supabase');
      const dbData = {
        id: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
        is_admin: true,
        onboarding_complete: false,
        created_at: '2024-01-01T00:00:00Z',
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: dbData,
              error: null,
            }),
          }),
        }),
      });

      const result = await userProfileService.fetchProfile(mockUserId);

      expect(result.isAdmin).toBe(true);
      expect(result.onboardingComplete).toBe(false);
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
    });

    it('throws error when database query fails', async () => {
      const { supabase } = require('@/lib/supabase');
      const dbError = new Error('Database error');

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: dbError,
            }),
          }),
        }),
      });

      await expect(userProfileService.fetchProfile(mockUserId)).rejects.toThrow();
    });
  });

  // ============================================================
  // UPDATE PROFILE TESTS
  // ============================================================

  describe('updateProfile', () => {
    it('updates profile and returns updated data', async () => {
      const { supabase } = require('@/lib/supabase');
      const updates = { name: 'Updated Name' };
      const updatedData = {
        id: mockUserId,
        name: 'Updated Name',
        email: 'test@example.com',
      };

      // Mock the chain for checking existing profile
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { id: mockUserId },
        error: null,
      });

      // Mock the chain for update
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedData,
        error: null,
      });

      supabase.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: mockMaybeSingle,
                single: mockUpdateSingle,
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: mockUpdateSingle,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await userProfileService.updateProfile(mockUserId, updates);

      expect(result).toBeTruthy();
    });

    it('throws PROFILE_NOT_FOUND when profile does not exist', async () => {
      const { supabase } = require('@/lib/supabase');
      const updates = { name: 'Updated Name' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      await expect(
        userProfileService.updateProfile(mockUserId, updates)
      ).rejects.toThrow('PROFILE_NOT_FOUND');
    });

    it('handles otherAllergy and otherDiet fields', async () => {
      const { supabase } = require('@/lib/supabase');
      const updates = {
        name: 'Test',
        otherAllergy: ['sesame'],
        otherDiet: ['whole30'],
      };

      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { id: mockUserId },
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: mockUserId, ...updates },
              error: null,
            }),
          }),
        }),
      });

      supabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
        update: mockUpdate,
      }));

      await userProfileService.updateProfile(mockUserId, updates);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          other_allergy: ['sesame'],
          other_diet: ['whole30'],
        })
      );
    });
  });
});

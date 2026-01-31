/**
 * userProfileService Tests
 *
 * Tests for user profile service covering:
 * - Profile fetching
 * - Profile updating
 * - Cache integration
 * - Error handling
 * - Data transformation
 */

import userProfileService from '../userProfileService';
import { userProfileCache } from '@/services/cache';
import { userFactory } from '@/test/factories';

// Mock the supabase client
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  single: jest.fn(),
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}));

// Mock cache
jest.mock('@/services/cache', () => ({
  userProfileCache: {
    getUserProfile: jest.fn(),
    setUserProfile: jest.fn(),
    clearCache: jest.fn(),
  },
}));

describe('userProfileService', () => {
  const mockProfile = userFactory.createProfile();
  const mockUserId = mockProfile.id;

  beforeEach(() => {
    jest.clearAllMocks();
    (userProfileCache.getUserProfile as jest.Mock).mockResolvedValue(null);
    (userProfileCache.setUserProfile as jest.Mock).mockResolvedValue(undefined);
    (userProfileCache.clearCache as jest.Mock).mockResolvedValue(undefined);
  });

  // ============================================================
  // FETCH PROFILE TESTS
  // ============================================================

  describe('fetchProfile', () => {
    it('returns cached profile when available', async () => {
      (userProfileCache.getUserProfile as jest.Mock).mockResolvedValue(mockProfile);

      const result = await userProfileService.fetchProfile(mockUserId);

      expect(result).toEqual(mockProfile);
      expect(userProfileCache.getUserProfile).toHaveBeenCalledWith(mockUserId);
    });

    it('fetches from database when cache miss', async () => {
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

      (userProfileCache.getUserProfile as jest.Mock).mockResolvedValue(null);

      const result = await userProfileService.fetchProfile(mockUserId);

      expect(supabase.from).toHaveBeenCalledWith('user_profiles');
      expect(userProfileCache.setUserProfile).toHaveBeenCalled();
      expect(result).toBeTruthy();
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

      (userProfileCache.getUserProfile as jest.Mock).mockResolvedValue(null);

      await expect(userProfileService.fetchProfile(mockUserId)).rejects.toThrow();
    });

    it('caches fetched profile', async () => {
      const { supabase } = require('@/lib/supabase');
      const dbData = {
        id: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
        is_admin: false,
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

      (userProfileCache.getUserProfile as jest.Mock).mockResolvedValue(null);

      await userProfileService.fetchProfile(mockUserId);

      expect(userProfileCache.setUserProfile).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Object)
      );
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

      // Mock update chain
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: updatedData,
              error: null,
            }),
          }),
        }),
      });

      const result = await userProfileService.updateProfile(mockUserId, updates);

      expect(result).toBeTruthy();
      expect(userProfileCache.setUserProfile).toHaveBeenCalled();
    });

    it('throws error when update fails', async () => {
      const { supabase } = require('@/lib/supabase');
      const updates = { name: 'Updated Name' };
      const updateError = new Error('Update failed');

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: updateError }),
        }),
      });

      await expect(
        userProfileService.updateProfile(mockUserId, updates)
      ).rejects.toThrow();
    });

    it('handles otherAllergy and otherDiet fields', async () => {
      const { supabase } = require('@/lib/supabase');
      const updates = {
        name: 'Test',
        otherAllergy: ['sesame'],
        otherDiet: ['whole30'],
      };

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      supabase.from.mockReturnValue({
        update: mockUpdate,
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: mockUserId, ...updates },
              error: null,
            }),
          }),
        }),
      });

      await userProfileService.updateProfile(mockUserId, updates);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          other_allergy: ['sesame'],
          other_diet: ['whole30'],
        })
      );
    });

    it('updates cache after successful update', async () => {
      const { supabase } = require('@/lib/supabase');
      const updates = { name: 'Updated Name' };
      const updatedData = {
        id: mockUserId,
        name: 'Updated Name',
      };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: updatedData,
              error: null,
            }),
          }),
        }),
      });

      await userProfileService.updateProfile(mockUserId, updates);

      expect(userProfileCache.setUserProfile).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Object)
      );
    });
  });

  // ============================================================
  // CACHE MANAGEMENT TESTS
  // ============================================================

  describe('clearProfileCache', () => {
    it('clears the profile cache', async () => {
      await userProfileService.clearProfileCache();

      expect(userProfileCache.clearCache).toHaveBeenCalled();
    });
  });
});

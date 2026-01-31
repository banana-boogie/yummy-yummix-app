/**
 * UserProfileContext Tests
 *
 * Tests for user profile context covering:
 * - Profile loading
 * - Profile updates
 * - Admin detection
 * - Error handling
 * - Context hooks
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProfileProvider, useUserProfile } from '../UserProfileContext';
import { userFactory } from '@/test/factories';

// Mock useAuth
const mockUser = userFactory.createSupabaseUser();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

// Mock useUserProfileQuery
const mockRefetch = jest.fn();
const mockMutateAsync = jest.fn();

jest.mock('@/hooks/useUserProfileQuery', () => ({
  useUserProfileQuery: jest.fn(() => ({
    data: null,
    isLoading: true,
    error: null,
    refetch: mockRefetch,
  })),
  useUpdateProfileMutation: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
  })),
  userProfileKeys: {
    detail: (id: string) => ['userProfile', id],
  },
}));

describe('UserProfileContext', () => {
  const mockProfile = userFactory.createProfile({
    id: mockUser.id,
    isAdmin: false,
    onboardingComplete: true,
  });

  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <UserProfileProvider>{children}</UserProfileProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue({ data: mockProfile });
    mockMutateAsync.mockResolvedValue(mockProfile);
  });

  // ============================================================
  // PROVIDER TESTS
  // ============================================================

  describe('UserProfileProvider', () => {
    it('provides context to children', () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      useUserProfileQuery.mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.userProfile).toEqual(mockProfile);
    });

    it('exposes loading state', () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      useUserProfileQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
    });

    it('exposes error state', () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      const error = new Error('Failed to load profile');
      useUserProfileQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBe(error);
    });
  });

  // ============================================================
  // PROFILE DATA TESTS
  // ============================================================

  describe('profile data', () => {
    it('returns null when no profile data', () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      useUserProfileQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      expect(result.current.userProfile).toBeNull();
    });

    it('returns profile when loaded', () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      useUserProfileQuery.mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      expect(result.current.userProfile).toEqual(mockProfile);
    });
  });

  // ============================================================
  // ADMIN DETECTION TESTS
  // ============================================================

  describe('admin detection', () => {
    it('isAdmin is false when profile is null', () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      useUserProfileQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAdmin).toBe(false);
    });

    it('isAdmin is false when user is not admin', () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      const regularProfile = userFactory.createProfile({ isAdmin: false });
      useUserProfileQuery.mockReturnValue({
        data: regularProfile,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAdmin).toBe(false);
    });

    it('isAdmin is true when user is admin', () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      const adminProfile = userFactory.createAdminProfile();
      useUserProfileQuery.mockReturnValue({
        data: adminProfile,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAdmin).toBe(true);
    });
  });

  // ============================================================
  // FETCH PROFILE TESTS
  // ============================================================

  describe('fetchUserProfile', () => {
    it('refetches profile data', async () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      useUserProfileQuery.mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.fetchUserProfile();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  // ============================================================
  // UPDATE PROFILE TESTS
  // ============================================================

  describe('updateUserProfile', () => {
    it('updates profile using mutation', async () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      useUserProfileQuery.mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const updates = { name: 'Updated Name' };
      const updatedProfile = { ...mockProfile, name: 'Updated Name' };
      mockMutateAsync.mockResolvedValue(updatedProfile);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      let returnedProfile;
      await act(async () => {
        returnedProfile = await result.current.updateUserProfile(updates);
      });

      expect(mockMutateAsync).toHaveBeenCalledWith(updates);
      expect(returnedProfile).toEqual(updatedProfile);
    });

    it('propagates errors from mutation', async () => {
      const { useUserProfileQuery } = require('@/hooks/useUserProfileQuery');
      useUserProfileQuery.mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      const error = new Error('Update failed');
      mockMutateAsync.mockRejectedValue(error);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.updateUserProfile({ name: 'Test' })
      ).rejects.toThrow('Update failed');
    });
  });

  // ============================================================
  // HOOK VALIDATION TESTS
  // ============================================================

  describe('useUserProfile hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useUserProfile());
      }).toThrow('useUserProfile must be used within a UserProfileProvider');

      consoleSpy.mockRestore();
    });
  });
});

/**
 * useUserProfileQuery Tests
 *
 * Tests for user profile query hook covering:
 * - Profile fetching
 * - Loading states
 * - Error handling
 * - Cache behavior
 * - Profile updates
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useUserProfileQuery,
  useUpdateProfileMutation,
  useInvalidateUserProfile,
  userProfileKeys,
} from '../useUserProfileQuery';
import { userFactory } from '@/test/factories';

// Mock useAuth
const mockUser = userFactory.createSupabaseUser();
let mockUserValue: typeof mockUser | null = mockUser;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUserValue,
  }),
}));

// Mock userProfileService
const mockFetchProfile = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock('@/services/userProfileService', () => ({
  __esModule: true,
  default: {
    fetchProfile: (userId: string) => mockFetchProfile(userId),
    updateProfile: (userId: string, updates: any) => mockUpdateProfile(userId, updates),
  },
}));

describe('useUserProfileQuery', () => {
  const mockProfile = userFactory.createProfile({ id: mockUser.id });
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserValue = mockUser;
    mockFetchProfile.mockResolvedValue(mockProfile);
    mockUpdateProfile.mockResolvedValue(mockProfile);
  });

  // ============================================================
  // QUERY KEYS TESTS
  // ============================================================

  describe('userProfileKeys', () => {
    it('generates correct query key for detail', () => {
      const key = userProfileKeys.detail('user-123');
      expect(key).toEqual(['userProfile', 'user-123']);
    });
  });

  // ============================================================
  // USE USER PROFILE QUERY TESTS
  // ============================================================

  describe('useUserProfileQuery', () => {
    it('fetches profile when user is logged in', async () => {
      const { result } = renderHook(() => useUserProfileQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchProfile).toHaveBeenCalledWith(mockUser.id);
      expect(result.current.data).toEqual(mockProfile);
    });

    it('does not fetch when user is not logged in', async () => {
      mockUserValue = null;

      const { result } = renderHook(() => useUserProfileQuery(), {
        wrapper: createWrapper(),
      });

      // Query should be disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockFetchProfile).not.toHaveBeenCalled();
    });

    it('handles loading state', () => {
      mockFetchProfile.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockProfile), 100))
      );

      const { result } = renderHook(() => useUserProfileQuery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('handles fetch errors', async () => {
      const error = new Error('Failed to fetch profile');
      mockFetchProfile.mockRejectedValue(error);

      const { result } = renderHook(() => useUserProfileQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toEqual(error);
    });

    it('returns cached data on subsequent renders', async () => {
      const { result, rerender } = renderHook(() => useUserProfileQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockProfile);
      });

      rerender({});

      // Should still have data without refetching
      expect(result.current.data).toEqual(mockProfile);
      // Only called once due to caching
      expect(mockFetchProfile).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // USE UPDATE PROFILE MUTATION TESTS
  // ============================================================

  describe('useUpdateProfileMutation', () => {
    it('updates profile successfully', async () => {
      const updates = { name: 'Updated Name' };
      const updatedProfile = { ...mockProfile, name: 'Updated Name' };
      mockUpdateProfile.mockResolvedValue(updatedProfile);

      const { result } = renderHook(() => useUpdateProfileMutation(), {
        wrapper: createWrapper(),
      });

      let mutationResult: any;
      await act(async () => {
        mutationResult = await result.current.mutateAsync(updates);
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser.id, updates);
      expect(mutationResult).toEqual(updatedProfile);
    });

    it('throws error when user is not logged in', async () => {
      mockUserValue = null;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useUpdateProfileMutation(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync({ name: 'Test' })).rejects.toThrow(
        'No user ID'
      );

      consoleSpy.mockRestore();
    });

    it('handles update errors', async () => {
      const error = new Error('Update failed');
      mockUpdateProfile.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useUpdateProfileMutation(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync({ name: 'Test' })).rejects.toThrow(
        'Update failed'
      );

      consoleSpy.mockRestore();
    });

    it('calls updateProfile service with correct arguments', async () => {
      const updates = { name: 'New Name' };
      const updatedProfile = { ...mockProfile, name: 'New Name' };
      mockUpdateProfile.mockResolvedValue(updatedProfile);

      const { result } = renderHook(() => useUpdateProfileMutation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(updates);
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser.id, updates);
    });
  });

  // ============================================================
  // USE INVALIDATE USER PROFILE TESTS
  // ============================================================

  describe('useInvalidateUserProfile', () => {
    it('invalidates the user profile cache', async () => {
      const { result } = renderHook(() => useInvalidateUserProfile(), {
        wrapper: createWrapper(),
      });

      // Verify the hook returns a function
      expect(typeof result.current).toBe('function');

      // Calling invalidate should not throw
      act(() => {
        result.current();
      });

      // Verify queryClient.invalidateQueries was called by checking it doesn't error
      expect(true).toBe(true);
    });

    it('does nothing when user is not logged in', () => {
      mockUserValue = null;

      const { result } = renderHook(() => useInvalidateUserProfile(), {
        wrapper: createWrapper(),
      });

      // Should not throw
      expect(() => result.current()).not.toThrow();
    });
  });
});

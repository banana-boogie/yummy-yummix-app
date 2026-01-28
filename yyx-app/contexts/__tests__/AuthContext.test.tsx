/**
 * AuthContext Tests
 *
 * Tests for authentication context covering:
 * - Session initialization
 * - Deep link handling (auth callbacks and recipe links)
 * - Sign out functionality
 * - State management
 * - Pending deep link storage and processing
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { Linking, AppState } from 'react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { getMockSupabaseClient, createMockSession, createMockSupabaseUser } from '@/test/mocks/supabase';
import { userFactory } from '@/test/factories';
import { Storage } from '@/utils/storage';

// Mock Storage utility
jest.mock('@/utils/storage', () => ({
  Storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock expo-router
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock queryClient
jest.mock('@/lib/queryClient', () => ({
  queryClient: {
    removeQueries: jest.fn(),
  },
}));

// Mock QueryParams from expo-auth-session
jest.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: jest.fn((url: string) => {
    if (url.includes('error=')) {
      return {
        params: { error: 'access_denied', error_description: 'User cancelled' },
        errorCode: null,
      };
    }
    if (url.includes('access_token=')) {
      return {
        params: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        },
        errorCode: null,
      };
    }
    return { params: {}, errorCode: null };
  }),
}));

describe('AuthContext', () => {
  let mockSupabase: ReturnType<typeof getMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = getMockSupabaseClient();

    // Reset default mock implementations
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    (Storage.getItem as jest.Mock).mockResolvedValue(null);
    (Storage.setItem as jest.Mock).mockResolvedValue(undefined);
    (Storage.removeItem as jest.Mock).mockResolvedValue(undefined);

    // Mock Linking
    (Linking.addEventListener as jest.Mock) = jest.fn(() => ({ remove: jest.fn() }));
    (Linking.getInitialURL as jest.Mock) = jest.fn().mockResolvedValue(null);

    // Mock AppState
    (AppState.addEventListener as jest.Mock) = jest.fn(() => ({ remove: jest.fn() }));
  });

  // ============================================================
  // INITIALIZATION TESTS
  // ============================================================

  describe('initialization', () => {
    it('initializes with no session', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();

      // Wait for session check
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    it('initializes with existing session', async () => {
      const user = userFactory.createSupabaseUser();
      const session = createMockSession(user);

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toEqual(session);
      expect(result.current.user).toEqual(user);
    });

    it('subscribes to auth state changes', async () => {
      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
      });
    });

    it('subscribes to app state changes for auto-refresh', async () => {
      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      });
    });

    it('sets up deep link listener', async () => {
      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(Linking.addEventListener).toHaveBeenCalledWith('url', expect.any(Function));
      });
    });

    it('checks for initial URL on mount', async () => {
      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(Linking.getInitialURL).toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // SIGN OUT TESTS
  // ============================================================

  describe('signOut', () => {
    it('clears session and user state', async () => {
      const user = userFactory.createSupabaseUser();
      const session = createMockSession(user);

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('sets loading state during sign out', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const signOutPromise = act(async () => {
        await result.current.signOut();
      });

      await signOutPromise;

      expect(result.current.loading).toBe(false);
    });

    it('handles sign out errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockSupabase.auth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' } as any
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.current.loading).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================================
  // AUTH CALLBACK HANDLING
  // ============================================================

  describe('createSessionFromUrl', () => {
    it('creates session from valid auth callback URL', async () => {
      const user = userFactory.createSupabaseUser();
      const session = createMockSession(user);

      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session, user },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let resultSession: any;
      await act(async () => {
        resultSession = await result.current.createSessionFromUrl(
          'yummyyummix://auth/callback?access_token=mock-token&refresh_token=mock-refresh'
        );
      });

      expect(resultSession).toEqual(session);
      expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      });
    });

    it('returns null for non-auth callback URLs', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let resultSession: any;
      await act(async () => {
        resultSession = await result.current.createSessionFromUrl(
          'yummyyummix://recipes/123'
        );
      });

      expect(resultSession).toBeNull();
      expect(mockSupabase.auth.setSession).not.toHaveBeenCalled();
    });

    it('throws error when URL contains error parameters', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(async () => {
        await act(async () => {
          await result.current.createSessionFromUrl(
            'yummyyummix://auth/callback?error=access_denied&error_description=User%20cancelled'
          );
        });
      }).rejects.toThrow();
    });

    it('throws error when access token is missing', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock getQueryParams to return no access_token
      const QueryParams = require('expo-auth-session/build/QueryParams');
      QueryParams.getQueryParams.mockReturnValueOnce({
        params: {},
        errorCode: null,
      });

      await expect(async () => {
        await act(async () => {
          await result.current.createSessionFromUrl(
            'yummyyummix://auth/callback'
          );
        });
      }).rejects.toThrow('No access token found');
    });
  });

  // ============================================================
  // DEEP LINK HANDLING
  // ============================================================

  describe('handleDeepLink', () => {
    it('handles recipe preview API links', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let handled: boolean = false;
      await act(async () => {
        handled = result.current.handleDeepLink(
          'https://yummyyummix.app/api/recipe-preview/recipe-123'
        );
      });

      expect(handled).toBe(true);

      // Wait for navigation (300ms timeout in navigateToRecipe)
      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith({
          pathname: '/(tabs)/recipes/[id]',
          params: { id: 'recipe-123' },
        });
      }, { timeout: 500 });
    });

    it('handles regular recipe deep links', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let handled: boolean = false;
      await act(async () => {
        handled = result.current.handleDeepLink(
          'https://yummyyummix.app/recipes/recipe-456'
        );
      });

      expect(handled).toBe(true);

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith({
          pathname: '/(tabs)/recipes/[id]',
          params: { id: 'recipe-456' },
        });
      }, { timeout: 500 });
    });

    it('skips auth callback URLs', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let handled: boolean = false;
      await act(async () => {
        handled = result.current.handleDeepLink(
          'yummyyummix://auth/callback?access_token=test'
        );
      });

      expect(handled).toBe(false);
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('returns false for unrecognized URLs', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let handled: boolean = false;
      await act(async () => {
        handled = result.current.handleDeepLink(
          'yummyyummix://unknown-route'
        );
      });

      expect(handled).toBe(false);
    });

    it('handles malformed URLs gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let handled: boolean = false;
      await act(async () => {
        handled = result.current.handleDeepLink('not-a-valid-url');
      });

      expect(handled).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================================
  // PENDING DEEP LINK TESTS
  // ============================================================

  describe('pending deep links', () => {
    it('stores deep link when user is not logged in', async () => {
      // Set up no session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Set up deep link event listener to capture the handler
      let deepLinkHandler: ((event: { url: string }) => void) | null = null;
      (Linking.addEventListener as jest.Mock).mockImplementation((event, handler) => {
        if (event === 'url') {
          deepLinkHandler = handler;
        }
        return { remove: jest.fn() };
      });

      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(Linking.addEventListener).toHaveBeenCalled();
      });

      // Simulate deep link arrival
      if (deepLinkHandler) {
        await act(async () => {
          deepLinkHandler({ url: 'https://yummyyummix.app/recipes/recipe-123' });
        });
      }

      // Verify deep link was stored
      await waitFor(() => {
        expect(Storage.setItem).toHaveBeenCalledWith(
          'pendingDeepLink',
          'https://yummyyummix.app/recipes/recipe-123'
        );
      });
    });

    it('checks for pending deep link on mount', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let hasPending: boolean = false;
      await act(async () => {
        hasPending = await result.current.checkForPendingDeepLink();
      });

      expect(Storage.getItem).toHaveBeenCalledWith('pendingDeepLink');
      expect(hasPending).toBe(false);
    });

    it('returns true when pending deep link exists', async () => {
      (Storage.getItem as jest.Mock).mockResolvedValue('https://yummyyummix.app/recipes/123');

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let hasPending: boolean = false;
      await act(async () => {
        hasPending = await result.current.checkForPendingDeepLink();
      });

      expect(hasPending).toBe(true);
    });
  });

  // ============================================================
  // NAVIGATION HELPERS
  // ============================================================

  describe('navigation helpers', () => {
    it('navigates to home', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.navigateToHome();
      });

      // Wait for timeout (300ms in navigateToHome)
      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith('/');
      }, { timeout: 500 });
    });

    it('navigates to invalid link page', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.navigateToInvalidLink();
      });

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith('/auth/invalid-link');
      }, { timeout: 500 });
    });
  });

  // ============================================================
  // HOOK USAGE TESTS
  // ============================================================

  describe('useAuth hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleErrorSpy.mockRestore();
    });

    it('provides context when used inside provider', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('session');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('signOut');
      expect(result.current).toHaveProperty('createSessionFromUrl');
      expect(result.current).toHaveProperty('navigateToHome');
      expect(result.current).toHaveProperty('navigateToInvalidLink');
      expect(result.current).toHaveProperty('handleDeepLink');
      expect(result.current).toHaveProperty('checkForPendingDeepLink');
    });
  });
});

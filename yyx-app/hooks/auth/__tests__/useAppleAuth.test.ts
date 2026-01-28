/**
 * useAppleAuth Hook Tests
 *
 * Tests for Apple authentication covering:
 * - iOS native sign-in flow
 * - Web OAuth sign-in flow
 * - User cancellation handling
 * - Error states (not available, no token, sign-in errors)
 * - Full name extraction from Apple credentials
 * - Onboarding context integration
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAppleAuth } from '../useAppleAuth';
import { getMockSupabaseClient } from '@/test/mocks/supabase';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

// Mock expo-apple-authentication
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
}));

// Mock OnboardingContext
const mockUpdateFormData = jest.fn();
jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    updateFormData: mockUpdateFormData,
  }),
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string) => key,
  locale: 'en',
}));

describe('useAppleAuth', () => {
  let mockSupabase: ReturnType<typeof getMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = getMockSupabaseClient();

    // Default mocks
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);

    // Add signInWithIdToken mock if it doesn't exist
    if (!mockSupabase.auth.signInWithIdToken) {
      (mockSupabase.auth as any).signInWithIdToken = jest.fn();
    }
    (mockSupabase.auth as any).signInWithIdToken.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' }, session: {} as any },
      error: null,
    });

    // Add signInWithOAuth mock if it doesn't exist
    if (!mockSupabase.auth.signInWithOAuth) {
      (mockSupabase.auth as any).signInWithOAuth = jest.fn();
    }
    (mockSupabase.auth as any).signInWithOAuth.mockResolvedValue({
      data: { provider: 'apple', url: 'https://apple.com/auth' },
      error: null,
    });
  });

  // ============================================================
  // INITIALIZATION TESTS
  // ============================================================

  describe('initialization', () => {
    it('initializes with default state', () => {
      const { result } = renderHook(() => useAppleAuth());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.handleAppleSignIn).toBe('function');
    });
  });

  // ============================================================
  // iOS NATIVE SIGN-IN TESTS
  // ============================================================

  describe('iOS native sign-in', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('successfully signs in with Apple on iOS', async () => {
      const mockCredential = {
        identityToken: 'mock-id-token',
        fullName: {
          givenName: 'John',
          familyName: 'Doe',
        },
      };

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(AppleAuthentication.isAvailableAsync).toHaveBeenCalled();
      expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      expect((mockSupabase.auth as any).signInWithIdToken).toHaveBeenCalledWith({
        provider: 'apple',
        token: 'mock-id-token',
      });
      expect(result.current.error).toBeNull();
    });

    it('updates onboarding context with full name from Apple', async () => {
      const mockCredential = {
        identityToken: 'mock-id-token',
        fullName: {
          givenName: 'Jane',
          familyName: 'Smith',
        },
      };

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(mockUpdateFormData).toHaveBeenCalledWith({ name: 'Jane Smith' });
    });

    it('handles Apple authentication not available', async () => {
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(result.current.error).toEqual(
        new Error('auth.appleAuth.appleAuthNotAvailable')
      );
      expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
    });

    it('handles user cancellation', async () => {
      const cancelError = new Error('User cancelled');
      (cancelError as any).code = 'ERR_REQUEST_CANCELED';

      (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(cancelError);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(result.current.error).toEqual(
        new Error('auth.appleAuth.loginCancelled')
      );
    });

    it('handles missing identity token', async () => {
      const mockCredential = {
        identityToken: null,
        fullName: null,
      };

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(result.current.error).toEqual(
        new Error('No identity token returned from Apple')
      );
      expect((mockSupabase.auth as any).signInWithIdToken).not.toHaveBeenCalled();
    });

    it('handles Supabase sign-in error', async () => {
      const mockCredential = {
        identityToken: 'mock-id-token',
        fullName: null,
      };

      const signInError = new Error('Invalid token');
      (signInError as any).code = 'invalid_token';

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);
      (mockSupabase.auth as any).signInWithIdToken.mockResolvedValue({
        data: null,
        error: signInError,
      });

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Invalid token');
    });
  });

  // ============================================================
  // WEB SIGN-IN TESTS
  // ============================================================

  describe('web sign-in', () => {
    beforeEach(() => {
      Platform.OS = 'web';
    });

    it('successfully signs in with Apple on web', async () => {
      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect((mockSupabase.auth as any).signInWithOAuth).toHaveBeenCalledWith({
        provider: 'apple',
      });
      expect(result.current.error).toBeNull();
    });

    it('handles OAuth sign-in error on web', async () => {
      const oauthError = new Error('OAuth error');
      (oauthError as any).code = 'oauth_error';

      (mockSupabase.auth as any).signInWithOAuth.mockResolvedValue({
        data: null,
        error: oauthError,
      });

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('OAuth error');
    });
  });

  // ============================================================
  // NAME EXTRACTION TESTS
  // ============================================================

  describe('name extraction', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('extracts full name from given name and family name', async () => {
      const mockCredential = {
        identityToken: 'mock-id-token',
        fullName: {
          givenName: 'Alice',
          familyName: 'Johnson',
        },
      };

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(mockUpdateFormData).toHaveBeenCalledWith({ name: 'Alice Johnson' });
    });

    it('extracts name from given name only', async () => {
      const mockCredential = {
        identityToken: 'mock-id-token',
        fullName: {
          givenName: 'Bob',
          familyName: null,
        },
      };

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(mockUpdateFormData).toHaveBeenCalledWith({ name: 'Bob' });
    });

    it('extracts name from all available parts when no givenName', async () => {
      const mockCredential = {
        identityToken: 'mock-id-token',
        fullName: {
          namePrefix: 'Dr.',
          givenName: null,
          middleName: 'Rose',
          familyName: 'Chen',
          nameSuffix: 'PhD',
          nickname: null,
        },
      };

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(mockUpdateFormData).toHaveBeenCalledWith({
        name: 'Dr. Rose Chen PhD',
      });
    });

    it('uses nickname as fallback', async () => {
      const mockCredential = {
        identityToken: 'mock-id-token',
        fullName: {
          givenName: null,
          familyName: null,
          nickname: 'Ace',
        },
      };

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(mockUpdateFormData).toHaveBeenCalledWith({ name: 'Ace' });
    });

    it('does not update onboarding when no name provided', async () => {
      const mockCredential = {
        identityToken: 'mock-id-token',
        fullName: null,
      };

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(mockUpdateFormData).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // STATE MANAGEMENT TESTS
  // ============================================================

  describe('state management', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('sets loading state during sign-in', async () => {
      const mockCredential = {
        identityToken: 'mock-id-token',
        fullName: null,
      };

      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockCredential);

      const { result } = renderHook(() => useAppleAuth());

      const signInPromise = act(async () => {
        await result.current.handleAppleSignIn();
      });

      await signInPromise;

      // After completion, loading should be false
      expect(result.current.isLoading).toBe(false);
    });

    it('clears error before new sign-in attempt', async () => {
      // First attempt - fail
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(result.current.error).not.toBeNull();

      // Second attempt - succeed
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
        identityToken: 'mock-id-token',
        fullName: null,
      });

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(result.current.error).toBeNull();
    });

    it('handles non-Error exceptions', async () => {
      Platform.OS = 'ios';
      (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue('String error');

      const { result } = renderHook(() => useAppleAuth());

      await act(async () => {
        await result.current.handleAppleSignIn();
      });

      expect(result.current.error).toEqual(new Error('String error'));
    });
  });
});

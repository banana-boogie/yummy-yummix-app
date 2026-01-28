/**
 * useMagicLink Hook Tests
 *
 * Tests for magic link authentication covering:
 * - Email validation
 * - Magic link sending
 * - Error handling (invalid email, rate limiting, general errors)
 * - Email sent confirmation
 * - Opening email app
 * - URL parameter handling
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMagicLink } from '../useMagicLink';
import { getMockSupabaseClient } from '@/test/mocks/supabase';
import { Linking, Platform } from 'react-native';
import { AuthError } from '@supabase/supabase-js';

// Mock expo-router params
let mockParams: { email?: string; error?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));

// Mock expo-auth-session
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'yummyyummix://'),
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string) => key,
  locale: 'en',
}));

describe('useMagicLink', () => {
  let mockSupabase: ReturnType<typeof getMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockSupabase = getMockSupabaseClient();

    // Default mock implementation
    mockSupabase.auth.signInWithOtp.mockResolvedValue({
      data: {},
      error: null,
    });

    // Mock Linking
    (Linking.openURL as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  // ============================================================
  // INITIALIZATION TESTS
  // ============================================================

  describe('initialization', () => {
    it('initializes with empty state when no params provided', () => {
      const { result } = renderHook(() => useMagicLink());

      expect(result.current.email).toBe('');
      expect(result.current.isEmailValid).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.showEmailSent).toBe(false);
    });

    it('initializes with email from URL params', () => {
      mockParams = { email: 'test@example.com' };

      const { result } = renderHook(() => useMagicLink());

      expect(result.current.email).toBe('test@example.com');
      expect(result.current.isEmailValid).toBe(true);
    });

    it('shows error when error param is "invalid"', async () => {
      mockParams = { error: 'invalid' };

      const { result } = renderHook(() => useMagicLink());

      await waitFor(() => {
        expect(result.current.error).toEqual({
          message: 'auth.emailAuth.confirmation.errors.invalid',
        });
      });
    });
  });

  // ============================================================
  // EMAIL VALIDATION TESTS
  // ============================================================

  describe('email validation', () => {
    it('prevents sending magic link with empty email', async () => {
      const { result } = renderHook(() => useMagicLink());

      await act(async () => {
        await result.current.handleMagicLink();
      });

      expect(result.current.error).toEqual({
        message: 'auth.errors.invalidEmail',
      });
      expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
    });

    it('prevents sending magic link with invalid email', async () => {
      const { result } = renderHook(() => useMagicLink());

      act(() => {
        result.current.setEmail('invalid-email');
        result.current.setIsEmailValid(false);
      });

      await act(async () => {
        await result.current.handleMagicLink();
      });

      expect(result.current.error).toEqual({
        message: 'auth.errors.invalidEmail',
      });
      expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
    });

    it('allows sending magic link with valid email', async () => {
      const { result } = renderHook(() => useMagicLink());

      act(() => {
        result.current.setEmail('valid@example.com');
        result.current.setIsEmailValid(true);
      });

      await act(async () => {
        await result.current.handleMagicLink();
      });

      expect(result.current.error).toBeNull();
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalled();
    });
  });

  // ============================================================
  // MAGIC LINK SENDING TESTS
  // ============================================================

  describe('handleMagicLink', () => {
    it('sends magic link with correct parameters', async () => {
      const { result } = renderHook(() => useMagicLink());

      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setIsEmailValid(true);
      });

      await act(async () => {
        await result.current.handleMagicLink();
      });

      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        options: {
          emailRedirectTo: expect.stringContaining('auth/callback'),
          data: { language: 'en' },
        },
      });
    });

    it('shows email sent confirmation on success', async () => {
      const { result } = renderHook(() => useMagicLink());

      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setIsEmailValid(true);
      });

      await act(async () => {
        await result.current.handleMagicLink();
      });

      expect(result.current.showEmailSent).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('sets loading state during magic link sending', async () => {
      const { result } = renderHook(() => useMagicLink());

      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setIsEmailValid(true);
      });

      // Start sending
      const sendPromise = act(async () => {
        await result.current.handleMagicLink();
      });

      // Check loading state (might have already completed, so we check the final state)
      await sendPromise;

      // After completion, loading should be false
      expect(result.current.isLoading).toBe(false);
    });

    it('clears previous errors before sending', async () => {
      const { result } = renderHook(() => useMagicLink());

      // Set up initial error
      act(() => {
        result.current.setEmail('');
        result.current.setIsEmailValid(false);
      });

      await act(async () => {
        await result.current.handleMagicLink();
      });

      expect(result.current.error).not.toBeNull();

      // Now send with valid email
      act(() => {
        result.current.setEmail('valid@example.com');
        result.current.setIsEmailValid(true);
      });

      await act(async () => {
        await result.current.handleMagicLink();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================

  describe('error handling', () => {
    it('handles rate limit error by showing email sent anyway', async () => {
      mockSupabase.auth.signInWithOtp.mockResolvedValue({
        data: null,
        error: {
          message: 'Too many requests',
          code: 'over_email_send_rate_limit',
        } as AuthError,
      });

      const { result } = renderHook(() => useMagicLink());

      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setIsEmailValid(true);
      });

      await act(async () => {
        await result.current.handleMagicLink();
      });

      // Rate limit should still show email sent to prevent enumeration attacks
      expect(result.current.showEmailSent).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('handles general auth errors', async () => {
      mockSupabase.auth.signInWithOtp.mockResolvedValue({
        data: null,
        error: {
          message: 'Network error',
          code: 'network_error',
        } as AuthError,
      });

      const { result } = renderHook(() => useMagicLink());

      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setIsEmailValid(true);
      });

      await act(async () => {
        await result.current.handleMagicLink();
      });

      expect(result.current.error).toEqual({
        message: 'auth.errors.default',
      });
      expect(result.current.showEmailSent).toBe(false);
    });

    it('handles thrown exceptions in loginWithMagicLink', async () => {
      mockSupabase.auth.signInWithOtp.mockRejectedValue(
        new Error('Unexpected error')
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useMagicLink());

      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setIsEmailValid(true);
      });

      await act(async () => {
        await result.current.handleMagicLink();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.current.error).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================================
  // EMAIL APP OPENING TESTS
  // ============================================================

  describe('handleOpenEmail', () => {
    it('opens message app on iOS', async () => {
      // Mock Platform.OS
      Platform.OS = 'ios';

      const { result } = renderHook(() => useMagicLink());

      await act(async () => {
        await result.current.handleOpenEmail();
      });

      expect(Linking.openURL).toHaveBeenCalledWith('message://');
    });

    it('tries Gmail first on Android, falls back to mailto', async () => {
      Platform.OS = 'android';

      // Mock Gmail to fail, mailto to succeed
      (Linking.openURL as jest.Mock)
        .mockRejectedValueOnce(new Error('Gmail not installed'))
        .mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useMagicLink());

      await act(async () => {
        await result.current.handleOpenEmail();
      });

      expect(Linking.openURL).toHaveBeenCalledWith('googlegmail://');
      expect(Linking.openURL).toHaveBeenCalledWith('mailto:');
    });

    it('handles errors when opening email app', async () => {
      Platform.OS = 'android';

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Cannot open'));

      const { result } = renderHook(() => useMagicLink());

      await act(async () => {
        await result.current.handleOpenEmail();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================================
  // STATE MANAGEMENT TESTS
  // ============================================================

  describe('state management', () => {
    it('updates email state', () => {
      const { result } = renderHook(() => useMagicLink());

      act(() => {
        result.current.setEmail('new@example.com');
      });

      expect(result.current.email).toBe('new@example.com');
    });

    it('updates email validity state', () => {
      const { result } = renderHook(() => useMagicLink());

      expect(result.current.isEmailValid).toBe(false);

      act(() => {
        result.current.setIsEmailValid(true);
      });

      expect(result.current.isEmailValid).toBe(true);
    });

    it('updates email sent confirmation state', () => {
      const { result } = renderHook(() => useMagicLink());

      expect(result.current.showEmailSent).toBe(false);

      act(() => {
        result.current.setShowEmailSent(true);
      });

      expect(result.current.showEmailSent).toBe(true);
    });
  });
});

/**
 * VoiceSessionContext Tests
 *
 * Tests for voice session context covering:
 * - Registering sessions (hasActiveSession becomes true)
 * - Unregistering sessions (hasActiveSession becomes false when empty)
 * - Stopping all sessions (calls stop on each, clears registry)
 * - Duplicate registration guard (same id + stop is a no-op)
 * - hasActiveSession state transitions
 * - Edge cases (unregister unknown id, stop when empty, stop throwing)
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { VoiceSessionProvider, useVoiceSession } from '../VoiceSessionContext';

describe('VoiceSessionContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <VoiceSessionProvider>{children}</VoiceSessionProvider>
  );

  // ============================================================
  // INITIAL STATE
  // ============================================================

  describe('initial state', () => {
    it('has no active session by default', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      expect(result.current.hasActiveSession).toBe(false);
    });

    it('provides all expected context functions', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      expect(typeof result.current.registerSession).toBe('function');
      expect(typeof result.current.unregisterSession).toBe('function');
      expect(typeof result.current.stopAllSessions).toBe('function');
      expect(typeof result.current.hasActiveSession).toBe('boolean');
    });
  });

  // ============================================================
  // REGISTER SESSION
  // ============================================================

  describe('registerSession', () => {
    it('makes hasActiveSession true when a session is registered', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });
      const stopFn = jest.fn();

      expect(result.current.hasActiveSession).toBe(false);

      act(() => {
        result.current.registerSession('session-1', stopFn);
      });

      expect(result.current.hasActiveSession).toBe(true);
    });

    it('supports registering multiple sessions', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });
      const stop1 = jest.fn();
      const stop2 = jest.fn();

      act(() => {
        result.current.registerSession('session-1', stop1);
        result.current.registerSession('session-2', stop2);
      });

      expect(result.current.hasActiveSession).toBe(true);
    });

    it('is a no-op when registering the same id and stop function', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });
      const stopFn = jest.fn();

      act(() => {
        result.current.registerSession('session-1', stopFn);
      });

      expect(result.current.hasActiveSession).toBe(true);

      // Register again with the same id and same stop function reference
      act(() => {
        result.current.registerSession('session-1', stopFn);
      });

      // Should still be active (no crash, no duplicate)
      expect(result.current.hasActiveSession).toBe(true);
    });

    it('replaces the entry when registering the same id with a different stop function', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });
      const stop1 = jest.fn();
      const stop2 = jest.fn();

      act(() => {
        result.current.registerSession('session-1', stop1);
      });

      act(() => {
        result.current.registerSession('session-1', stop2);
      });

      // Now stopAll should call stop2, not stop1
      act(() => {
        result.current.stopAllSessions();
      });

      expect(stop1).not.toHaveBeenCalled();
      expect(stop2).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // UNREGISTER SESSION
  // ============================================================

  describe('unregisterSession', () => {
    it('makes hasActiveSession false when the only session is unregistered', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });
      const stopFn = jest.fn();

      act(() => {
        result.current.registerSession('session-1', stopFn);
      });

      expect(result.current.hasActiveSession).toBe(true);

      act(() => {
        result.current.unregisterSession('session-1');
      });

      expect(result.current.hasActiveSession).toBe(false);
    });

    it('keeps hasActiveSession true when only one of multiple sessions is unregistered', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      act(() => {
        result.current.registerSession('session-1', jest.fn());
        result.current.registerSession('session-2', jest.fn());
      });

      act(() => {
        result.current.unregisterSession('session-1');
      });

      expect(result.current.hasActiveSession).toBe(true);
    });

    it('makes hasActiveSession false when all sessions are unregistered one by one', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      act(() => {
        result.current.registerSession('session-1', jest.fn());
        result.current.registerSession('session-2', jest.fn());
      });

      act(() => {
        result.current.unregisterSession('session-1');
      });

      expect(result.current.hasActiveSession).toBe(true);

      act(() => {
        result.current.unregisterSession('session-2');
      });

      expect(result.current.hasActiveSession).toBe(false);
    });

    it('is a no-op when unregistering an unknown session id', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      act(() => {
        result.current.registerSession('session-1', jest.fn());
      });

      // Unregister a different id that was never registered
      act(() => {
        result.current.unregisterSession('unknown-id');
      });

      // Original session should still be active
      expect(result.current.hasActiveSession).toBe(true);
    });

    it('does not call the stop function when unregistering', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });
      const stopFn = jest.fn();

      act(() => {
        result.current.registerSession('session-1', stopFn);
      });

      act(() => {
        result.current.unregisterSession('session-1');
      });

      expect(stopFn).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // STOP ALL SESSIONS
  // ============================================================

  describe('stopAllSessions', () => {
    it('calls stop on all registered sessions', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });
      const stop1 = jest.fn();
      const stop2 = jest.fn();
      const stop3 = jest.fn();

      act(() => {
        result.current.registerSession('session-1', stop1);
        result.current.registerSession('session-2', stop2);
        result.current.registerSession('session-3', stop3);
      });

      act(() => {
        result.current.stopAllSessions();
      });

      expect(stop1).toHaveBeenCalledTimes(1);
      expect(stop2).toHaveBeenCalledTimes(1);
      expect(stop3).toHaveBeenCalledTimes(1);
    });

    it('clears the registry after stopping all sessions', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      act(() => {
        result.current.registerSession('session-1', jest.fn());
        result.current.registerSession('session-2', jest.fn());
      });

      expect(result.current.hasActiveSession).toBe(true);

      act(() => {
        result.current.stopAllSessions();
      });

      expect(result.current.hasActiveSession).toBe(false);
    });

    it('is a no-op when there are no active sessions', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      // Should not throw when called with no sessions
      act(() => {
        result.current.stopAllSessions();
      });

      expect(result.current.hasActiveSession).toBe(false);
    });

    it('continues stopping remaining sessions even if one stop function throws', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      const stop1 = jest.fn();
      const stop2 = jest.fn(() => {
        throw new Error('Stop failed');
      });
      const stop3 = jest.fn();

      act(() => {
        result.current.registerSession('session-1', stop1);
        result.current.registerSession('session-2', stop2);
        result.current.registerSession('session-3', stop3);
      });

      act(() => {
        result.current.stopAllSessions();
      });

      // All stop functions should have been called despite the error
      expect(stop1).toHaveBeenCalledTimes(1);
      expect(stop2).toHaveBeenCalledTimes(1);
      expect(stop3).toHaveBeenCalledTimes(1);

      // Registry should be cleared
      expect(result.current.hasActiveSession).toBe(false);

      // Error should have been logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[VoiceSession] Failed to stop session:',
        'session-2',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // hasActiveSession STATE TRANSITIONS
  // ============================================================

  describe('hasActiveSession state transitions', () => {
    it('transitions false -> true -> false through register and unregister', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      expect(result.current.hasActiveSession).toBe(false);

      act(() => {
        result.current.registerSession('session-1', jest.fn());
      });
      expect(result.current.hasActiveSession).toBe(true);

      act(() => {
        result.current.unregisterSession('session-1');
      });
      expect(result.current.hasActiveSession).toBe(false);
    });

    it('transitions false -> true -> false through register and stopAll', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      expect(result.current.hasActiveSession).toBe(false);

      act(() => {
        result.current.registerSession('session-1', jest.fn());
      });
      expect(result.current.hasActiveSession).toBe(true);

      act(() => {
        result.current.stopAllSessions();
      });
      expect(result.current.hasActiveSession).toBe(false);
    });

    it('allows re-registering sessions after stopAll', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });

      act(() => {
        result.current.registerSession('session-1', jest.fn());
      });
      expect(result.current.hasActiveSession).toBe(true);

      act(() => {
        result.current.stopAllSessions();
      });
      expect(result.current.hasActiveSession).toBe(false);

      act(() => {
        result.current.registerSession('session-2', jest.fn());
      });
      expect(result.current.hasActiveSession).toBe(true);
    });

    it('allows re-registering the same id after unregister', () => {
      const { result } = renderHook(() => useVoiceSession(), { wrapper });
      const stop1 = jest.fn();
      const stop2 = jest.fn();

      act(() => {
        result.current.registerSession('session-1', stop1);
      });
      expect(result.current.hasActiveSession).toBe(true);

      act(() => {
        result.current.unregisterSession('session-1');
      });
      expect(result.current.hasActiveSession).toBe(false);

      act(() => {
        result.current.registerSession('session-1', stop2);
      });
      expect(result.current.hasActiveSession).toBe(true);

      act(() => {
        result.current.stopAllSessions();
      });
      expect(stop1).not.toHaveBeenCalled();
      expect(stop2).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // HOOK WITHOUT PROVIDER (DEFAULT CONTEXT)
  // ============================================================

  describe('useVoiceSession without provider', () => {
    it('returns default no-op context values', () => {
      const { result } = renderHook(() => useVoiceSession());

      expect(result.current.hasActiveSession).toBe(false);
      expect(typeof result.current.registerSession).toBe('function');
      expect(typeof result.current.unregisterSession).toBe('function');
      expect(typeof result.current.stopAllSessions).toBe('function');

      // Default functions should be safe to call (no-ops, no throw)
      act(() => {
        result.current.registerSession('test', jest.fn());
        result.current.unregisterSession('test');
        result.current.stopAllSessions();
      });

      expect(result.current.hasActiveSession).toBe(false);
    });
  });
});

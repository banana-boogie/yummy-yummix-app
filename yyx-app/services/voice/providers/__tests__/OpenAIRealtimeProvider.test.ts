/**
 * OpenAIRealtimeProvider Tests
 *
 * Focused regression coverage for quota checks.
 *
 * FOR AI AGENTS:
 * - These tests only exercise getRemainingQuota() to avoid WebRTC/session setup.
 * - Keep native module mocks in this file because the provider imports them at module load.
 */

import { supabase } from '@/lib/supabase';

jest.mock('react-native-webrtc', () => ({
  RTCPeerConnection: jest.fn(),
  RTCSessionDescription: jest.fn(),
  mediaDevices: { getUserMedia: jest.fn() },
  MediaStreamTrack: jest.fn(),
}));

jest.mock('react-native-incall-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    stop: jest.fn(),
    setForceSpeakerphoneOn: jest.fn(),
  },
}));

jest.mock('../../shared/VoiceUtils', () => ({
  buildSystemPrompt: jest.fn(() => 'system prompt'),
  detectGoodbye: jest.fn(() => false),
  InactivityTimer: class {
    reset = jest.fn();
    clear = jest.fn();
  },
}));

jest.mock('../../shared/VoiceToolDefinitions', () => ({
  voiceTools: [],
}));

import { OpenAIRealtimeProvider } from '../OpenAIRealtimeProvider';

describe('OpenAIRealtimeProvider', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = mockFetch;
    process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL =
      'https://example.functions.supabase.co';

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });
  });

  describe('getRemainingQuota', () => {
    it('throws when user is not authenticated', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const provider = new OpenAIRealtimeProvider();

      await expect(provider.getRemainingQuota()).rejects.toThrow(
        'Not authenticated',
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws a meaningful error when quota check endpoint is non-2xx', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({ error: 'quota exceeded' }),
      });

      const provider = new OpenAIRealtimeProvider();

      await expect(provider.getRemainingQuota()).rejects.toThrow(
        'Quota check failed: 429',
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.functions.supabase.co/irmixy-voice-orchestrator',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('returns parsed quota values when endpoint succeeds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          remainingMinutes: '12.5',
          minutesUsed: '17.5',
          quotaLimit: 30,
        }),
      });

      const provider = new OpenAIRealtimeProvider();

      await expect(provider.getRemainingQuota()).resolves.toEqual({
        remainingMinutes: 12.5,
        minutesUsed: 17.5,
        quotaLimit: 30,
      });
    });
  });
});


/**
 * WebVoiceProvider Tests
 *
 * Regression coverage for localized web fallback behavior.
 */

import { WebVoiceProvider } from '../WebVoiceProvider';

jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'chat.voice.mobileOnly.message': 'Voice chat is available on our mobile app.',
      'chat.voice.mobileOnly.hint': 'Use our mobile app for voice features.',
    };
    return translations[key] || key;
  },
}));

describe('WebVoiceProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits a localized error when starting conversation', async () => {
    const provider = new WebVoiceProvider();
    const onError = jest.fn();

    provider.on('error', onError);

    await provider.startConversation({
      userContext: {
        language: 'en',
        measurementSystem: 'metric',
        dietaryRestrictions: [],
        dietTypes: [],
      },
    });

    expect(provider.getStatus()).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect((onError.mock.calls[0][0] as Error).message).toBe(
      'Voice chat is available on our mobile app.',
    );
  });

  it('returns localized warning text in quota response', async () => {
    const provider = new WebVoiceProvider();

    await expect(provider.getRemainingQuota()).resolves.toEqual({
      remainingMinutes: 0,
      minutesUsed: 0,
      quotaLimit: 0,
      warning: 'Use our mobile app for voice features.',
    });
  });
});

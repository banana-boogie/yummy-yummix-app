/**
 * VoiceAssistantButton Web Tests
 *
 * Regression coverage for web-only CTA behavior.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { VoiceAssistantButton } from '../VoiceAssistantButton.web';

jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'chat.voice.mobileOnly.title': 'Voice Chat',
      'chat.voice.mobileOnly.message': 'Voice chat is available on our mobile app.',
      'common.ok': 'OK',
    };

    return translations[key] || key;
  },
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

describe('VoiceAssistantButton.web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a mobile-only voice CTA', () => {
    render(<VoiceAssistantButton />);

    expect(screen.getByTestId('web-voice-cta')).toBeTruthy();
    expect(screen.getByText('Voice Chat')).toBeTruthy();
  });

  it('shows a mobile-only alert when CTA is pressed', () => {
    render(<VoiceAssistantButton />);

    fireEvent.press(screen.getByTestId('web-voice-cta-button'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Voice Chat',
      'Voice chat is available on our mobile app.',
      [{ text: 'OK' }],
    );
  });
});

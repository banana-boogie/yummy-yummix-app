import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ChatResumeBar } from '../ChatResumeBar';

jest.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    if (key === 'chat.resume.chatAbout') {
      return `You were chatting about '${params?.title}'`;
    }

    const translations: Record<string, string> = {
      'chat.resume.continue': 'Continue',
      'common.cancel': 'Cancel',
    };

    return translations[key] || key;
  },
}));

describe('ChatResumeBar', () => {
  it('renders session title text', () => {
    render(
      <ChatResumeBar
        sessionTitle="Pasta Carbonara"
        onContinue={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(screen.getByText("You were chatting about 'Pasta Carbonara'")).toBeTruthy();
  });

  it('calls onContinue when continue button is pressed', () => {
    const onContinue = jest.fn();

    render(
      <ChatResumeBar
        sessionTitle="Pasta Carbonara"
        onContinue={onContinue}
        onDismiss={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText('Continue'));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when close button is pressed', () => {
    const onDismiss = jest.fn();

    render(
      <ChatResumeBar
        sessionTitle="Pasta Carbonara"
        onContinue={jest.fn()}
        onDismiss={onDismiss}
      />
    );

    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

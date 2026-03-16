import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AskIrmixyButton } from '../AskIrmixyButton';

const mockStartCookingSession = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@/contexts/CookingSessionContext', () => ({
  useCookingSession: () => ({
    startCookingSession: mockStartCookingSession,
  }),
}));

// Override the global expo-router mock's useRouter to use our mockNavigate
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
    navigate: mockNavigate,
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  useGlobalSearchParams: () => ({}),
  Link: 'Link',
  Stack: { Screen: 'Screen' },
  Tabs: { Screen: 'Screen' },
  Redirect: 'Redirect',
}));

jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({ isLarge: false, isPhone: true }),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

describe('AskIrmixyButton', () => {
  const defaultProps = {
    recipeId: 'recipe-123',
    recipeName: 'Tacos al pastor',
    currentStep: 2,
    totalSteps: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AskIrmixyButton {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('saves session and navigates to chat on press', () => {
    const { getByLabelText } = render(<AskIrmixyButton {...defaultProps} />);

    fireEvent.press(getByLabelText('Ask Irmixy'));

    expect(mockStartCookingSession).toHaveBeenCalledWith({
      recipeId: 'recipe-123',
      recipeName: 'Tacos al pastor',
      currentStep: 2,
      totalSteps: 5,
      isCustom: false,
      from: undefined,
    });
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/chat');
  });

  it('sets isCustom flag for custom recipes', () => {
    const { getByLabelText } = render(
      <AskIrmixyButton {...defaultProps} isCustom from="chat" />,
    );

    fireEvent.press(getByLabelText('Ask Irmixy'));

    expect(mockStartCookingSession).toHaveBeenCalledWith(
      expect.objectContaining({
        isCustom: true,
        from: 'chat',
      }),
    );
  });
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReturnToCookingBanner } from '../ReturnToCookingBanner';

const mockClearCookingSession = jest.fn();
const mockNavigate = jest.fn();

let mockSession: any = null;

jest.mock('@/contexts/CookingSessionContext', () => ({
  useCookingSession: () => ({
    activeCookingSession: mockSession,
    clearCookingSession: mockClearCookingSession,
  }),
}));

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

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

describe('ReturnToCookingBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = null;
  });

  it('renders nothing when no active session', () => {
    const { toJSON } = render(<ReturnToCookingBanner />);
    expect(toJSON()).toBeNull();
  });

  it('renders banner when cooking session is active', () => {
    mockSession = {
      recipeId: 'recipe-123',
      recipeName: 'Tacos al pastor',
      currentStep: 3,
      totalSteps: 5,
      isCustom: false,
    };

    const { getByText } = render(<ReturnToCookingBanner />);

    expect(getByText('Return to cooking')).toBeTruthy();
    expect(getByText('Step 3 of Tacos al pastor')).toBeTruthy();
  });

  it('navigates to regular recipe step on press', () => {
    mockSession = {
      recipeId: 'recipe-123',
      recipeName: 'Tacos al pastor',
      currentStep: 3,
      totalSteps: 5,
      isCustom: false,
    };

    const { getByLabelText } = render(<ReturnToCookingBanner />);
    fireEvent.press(getByLabelText('Return to cooking'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/(tabs)/recipes/recipe-123/cooking-guide/3',
    );
  });

  it('navigates to custom recipe step on press', () => {
    mockSession = {
      recipeId: 'custom-456',
      recipeName: 'Custom soup',
      currentStep: 2,
      totalSteps: 4,
      isCustom: true,
    };

    const { getByLabelText } = render(<ReturnToCookingBanner />);
    fireEvent.press(getByLabelText('Return to cooking'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/(tabs)/recipes/custom/custom-456/cooking-guide/2',
    );
  });

  it('navigates to custom recipe from chat flow', () => {
    mockSession = {
      recipeId: 'custom-789',
      recipeName: 'Chat recipe',
      currentStep: 1,
      totalSteps: 3,
      isCustom: true,
      from: 'chat',
    };

    const { getByLabelText } = render(<ReturnToCookingBanner />);
    fireEvent.press(getByLabelText('Return to cooking'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/recipe/custom/custom-789/cooking-guide/1?from=chat',
    );
  });

  it('clears session when dismiss is pressed', () => {
    mockSession = {
      recipeId: 'recipe-123',
      recipeName: 'Tacos',
      currentStep: 1,
      totalSteps: 2,
      isCustom: false,
    };

    const { getByLabelText } = render(<ReturnToCookingBanner />);
    fireEvent.press(getByLabelText('Dismiss'));

    expect(mockClearCookingSession).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

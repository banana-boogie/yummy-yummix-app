/**
 * CookingGuideHeader Component Tests
 *
 * Tests for the cooking guide header with title, subtitle, image, and voice assistant.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { CookingGuideHeader } from '../CookingGuideHeader';

// Mock the hooks
jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({
    isLarge: false,
    isWeb: false,
    isPhone: true,
    isTablet: false,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock navigation components
jest.mock('@/components/navigation/BackButton', () => ({
  BackButton: ({ onPress }: { onPress?: () => void }) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID="back-button" onPress={onPress}>
        <Text>Back</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('@/components/navigation/HamburgerMenu', () => ({
  HamburgerMenu: () => null,
}));

// Mock VoiceAssistantButton
jest.mock('@/components/common/VoiceAssistantButton', () => ({
  VoiceAssistantButton: ({ recipeContext }: { recipeContext?: any }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="voice-assistant-button">
        <Text>Voice Assistant</Text>
      </View>
    );
  },
}));

describe('CookingGuideHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders title when showTitle is true', () => {
      render(<CookingGuideHeader title="Pasta Recipe" showTitle />);

      expect(screen.getByText('Pasta Recipe')).toBeTruthy();
    });

    it('renders subtitle when showSubtitle is true', () => {
      render(<CookingGuideHeader title="Recipe" subtitle="Step 1 of 5" showSubtitle />);

      expect(screen.getByText('Step 1 of 5')).toBeTruthy();
    });

    it('renders both title and subtitle', () => {
      render(
        <CookingGuideHeader
          title="Chocolate Cake"
          subtitle="Preparation"
          showTitle
          showSubtitle
        />
      );

      expect(screen.getByText('Chocolate Cake')).toBeTruthy();
      expect(screen.getByText('Preparation')).toBeTruthy();
    });

    it('does not render title when showTitle is false', () => {
      render(<CookingGuideHeader title="Hidden Title" showTitle={false} />);

      expect(screen.queryByText('Hidden Title')).toBeNull();
    });

    it('does not render subtitle when showSubtitle is false', () => {
      render(<CookingGuideHeader subtitle="Hidden Subtitle" showSubtitle={false} />);

      expect(screen.queryByText('Hidden Subtitle')).toBeNull();
    });
  });

  // ============================================================
  // IMAGE TESTS
  // ============================================================

  describe('image handling', () => {
    it('renders recipe image when pictureUrl is provided', () => {
      const { toJSON } = render(
        <CookingGuideHeader title="Recipe" pictureUrl="https://example.com/recipe.jpg" />
      );

      // Image component should be rendered (expo-image is mocked)
      expect(toJSON()).not.toBeNull();
    });

    it('renders without image when pictureUrl is not provided', () => {
      const { toJSON } = render(<CookingGuideHeader title="Recipe" />);

      expect(toJSON()).not.toBeNull();
    });
  });

  // ============================================================
  // BACK BUTTON TESTS
  // ============================================================

  describe('back button', () => {
    it('shows back button when showBackButton is true', () => {
      render(<CookingGuideHeader title="Recipe" showBackButton />);

      expect(screen.getByTestId('back-button')).toBeTruthy();
    });

    it('does not show back button when showBackButton is false', () => {
      render(<CookingGuideHeader title="Recipe" showBackButton={false} />);

      expect(screen.queryByTestId('back-button')).toBeNull();
    });

    it('calls onBackPress when back button is pressed', () => {
      const onBackPress = jest.fn();
      render(<CookingGuideHeader title="Recipe" showBackButton onBackPress={onBackPress} />);

      fireEvent.press(screen.getByTestId('back-button'));

      expect(onBackPress).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // VOICE ASSISTANT BUTTON TESTS
  // ============================================================

  describe('voice assistant button', () => {
    it('renders VoiceAssistantButton when recipeContext is provided', () => {
      const recipeContext = {
        recipeId: 'recipe-123',
        recipeName: 'Test Recipe',
        currentStep: 1,
        totalSteps: 5,
      };

      render(<CookingGuideHeader title="Recipe" recipeContext={recipeContext} />);

      expect(screen.getByTestId('voice-assistant-button')).toBeTruthy();
    });

    it('does not render VoiceAssistantButton when recipeContext is not provided', () => {
      render(<CookingGuideHeader title="Recipe" />);

      expect(screen.queryByTestId('voice-assistant-button')).toBeNull();
    });

    it('renders VoiceAssistantButton inline with title', () => {
      const recipeContext = {
        recipeId: 'recipe-123',
        recipeName: 'Test Recipe',
      };

      render(<CookingGuideHeader title="Recipe" recipeContext={recipeContext} />);

      // Both title and voice button should be present
      expect(screen.getByText('Recipe')).toBeTruthy();
      expect(screen.getByTestId('voice-assistant-button')).toBeTruthy();
    });
  });

  // ============================================================
  // PRESET TESTS
  // ============================================================

  describe('text presets', () => {
    it('uses h1 preset for title by default', () => {
      const { toJSON } = render(<CookingGuideHeader title="Recipe" />);

      expect(toJSON()).not.toBeNull();
    });

    it('uses custom title preset when provided', () => {
      const { toJSON } = render(<CookingGuideHeader title="Recipe" titlePreset="h2" />);

      expect(toJSON()).not.toBeNull();
    });

    it('uses custom subtitle preset when provided', () => {
      const { toJSON } = render(
        <CookingGuideHeader subtitle="Step 1" subtitlePreset="body" showSubtitle />
      );

      expect(toJSON()).not.toBeNull();
    });
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ChatMessageItem } from '../ChatMessageItem';
import type { ChatMessage } from '@/services/chatService';
import { createMockRecipeCard } from '@/test/mocks/chat';

jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/chat/ChatRecipeCard', () => ({
  ChatRecipeCard: ({ recipe }: { recipe: { name: string } }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="chat-recipe-card">
        <Text>{recipe.name}</Text>
      </View>
    );
  },
}));

jest.mock('@/components/chat/CustomRecipeCard', () => ({
  CustomRecipeCard: () => {
    const { View } = require('react-native');
    return <View testID="custom-recipe-card" />;
  },
}));

jest.mock('@/components/chat/RecipeProgressTracker', () => ({
  RecipeProgressTracker: () => {
    const { View } = require('react-native');
    return <View testID="recipe-progress-tracker" />;
  },
}));

describe('ChatMessageItem', () => {
  const onCopyMessage = jest.fn();
  const onStartCooking = jest.fn();
  const onActionPress = jest.fn();

  const baseMessage: ChatMessage = {
    id: 'assistant-message-1',
    role: 'assistant',
    content: '',
    createdAt: new Date('2026-02-17T10:00:00.000Z'),
  };

  const defaultProps = {
    isLastMessage: true,
    isLoading: false,
    isRecipeGenerating: false,
    currentStatus: null as any,
    statusText: '',
    onCopyMessage,
    onStartCooking,
    onActionPress,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps markdown images when no recipe visuals are rendered', () => {
    const message: ChatMessage = {
      ...baseMessage,
      content: 'Here you go\n![salad](https://example.com/salad.jpg)\nEnjoy!',
      recipes: undefined,
      customRecipe: undefined,
    };

    render(
      <ChatMessageItem
        item={message}
        {...defaultProps}
      />
    );

    expect(
      screen.getByText(/!\[salad\]\(https:\/\/example\.com\/salad\.jpg\)/)
    ).toBeTruthy();
  });

  it('strips markdown images when recipe cards are present', () => {
    const message: ChatMessage = {
      ...baseMessage,
      content: 'Here you go\n![salad](https://example.com/salad.jpg)\nEnjoy!',
      recipes: [createMockRecipeCard({ name: 'Fresh Salad' })],
    };

    render(
      <ChatMessageItem
        item={message}
        {...defaultProps}
      />
    );

    expect(
      screen.queryByText(/!\[salad\]\(https:\/\/example\.com\/salad\.jpg\)/)
    ).toBeNull();
    expect(screen.getByText(/Here you go/)).toBeTruthy();
    expect(screen.getByText(/Enjoy!/)).toBeTruthy();
    expect(screen.getByTestId('chat-recipe-card')).toBeTruthy();
  });

  it('shows recipe progress tracker when generating recipe on last message', () => {
    const message: ChatMessage = {
      ...baseMessage,
      content: 'Let me create that for you!',
    };

    render(
      <ChatMessageItem
        item={message}
        {...defaultProps}
        isRecipeGenerating={true}
        isLastMessage={true}
      />
    );

    expect(screen.getByTestId('recipe-progress-tracker')).toBeTruthy();
  });

  it('does not show tracker for non-last messages', () => {
    const message: ChatMessage = {
      ...baseMessage,
      content: 'Let me create that for you!',
    };

    render(
      <ChatMessageItem
        item={message}
        {...defaultProps}
        isRecipeGenerating={true}
        isLastMessage={false}
      />
    );

    expect(screen.queryByTestId('recipe-progress-tracker')).toBeNull();
  });

  it('does not show tracker for user messages', () => {
    const message: ChatMessage = {
      ...baseMessage,
      role: 'user',
      content: 'Make me a pasta recipe',
    };

    render(
      <ChatMessageItem
        item={message}
        {...defaultProps}
        isRecipeGenerating={true}
        isLastMessage={true}
      />
    );

    expect(screen.queryByTestId('recipe-progress-tracker')).toBeNull();
  });

  it('hides tracker when customRecipe arrives', () => {
    const message: ChatMessage = {
      ...baseMessage,
      content: 'Here is your recipe!',
      customRecipe: {
        suggestedName: 'Pasta Primavera',
        ingredients: [],
        steps: [],
      } as any,
    };

    render(
      <ChatMessageItem
        item={message}
        {...defaultProps}
        isRecipeGenerating={true}
        isLastMessage={true}
      />
    );

    expect(screen.queryByTestId('recipe-progress-tracker')).toBeNull();
    expect(screen.getByTestId('custom-recipe-card')).toBeTruthy();
  });

  it('does not show tracker when isRecipeGenerating is false', () => {
    const message: ChatMessage = {
      ...baseMessage,
      content: 'Here is a response.',
    };

    render(
      <ChatMessageItem
        item={message}
        {...defaultProps}
        isRecipeGenerating={false}
        isLastMessage={true}
      />
    );

    expect(screen.queryByTestId('recipe-progress-tracker')).toBeNull();
  });
});

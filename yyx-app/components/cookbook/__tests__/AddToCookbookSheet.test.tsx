import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/utils/render';
import { AddToCookbookSheet } from '../AddToCookbookSheet';
import i18n from '@/i18n';

jest.mock('@/hooks/useCookbookQuery', () => ({
  useUserCookbooksQuery: jest.fn(),
  useAddRecipeToCookbook: jest.fn(),
  useCreateCookbook: jest.fn(),
}));

jest.mock('@/services/cookbookService', () => ({
  cookbookService: {
    getCookbookIdsContainingRecipe: jest.fn(),
  },
}));

jest.mock('../CreateEditCookbookModal', () => ({
  CreateEditCookbookModal: ({ visible, onSave }) => {
    if (!visible) return null;
    const React = require('react');
    const { Pressable } = require('react-native');
    const { Text } = require('@/components/common');
    return (
      <Pressable onPress={() => onSave({ nameEn: 'New Cookbook' })}>
        <Text>Mock Save Cookbook</Text>
      </Pressable>
    );
  },
}));

const { useUserCookbooksQuery, useAddRecipeToCookbook, useCreateCookbook } =
  require('@/hooks/useCookbookQuery');
const { cookbookService } = require('@/services/cookbookService');

describe('AddToCookbookSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a cookbook in-sheet and advances to notes step', async () => {
    const createMutation = {
      mutateAsync: jest.fn().mockResolvedValue({
        id: 'cb-new',
        userId: 'user-1',
        name: 'New Cookbook',
        description: undefined,
        isPublic: false,
        isDefault: false,
        shareEnabled: false,
        shareToken: 'token',
        recipeCount: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
      isPending: false,
    };

    useUserCookbooksQuery.mockReturnValue({ data: [], isLoading: false });
    useAddRecipeToCookbook.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    useCreateCookbook.mockReturnValue(createMutation);
    cookbookService.getCookbookIdsContainingRecipe.mockResolvedValue([]);

    renderWithProviders(
      <AddToCookbookSheet
        visible
        onClose={jest.fn()}
        recipeId="recipe-1"
        recipeName="My Recipe"
      />
    );

    fireEvent.press(screen.getByText(i18n.t('cookbooks.createCookbook')));
    fireEvent.press(screen.getByText('Mock Save Cookbook'));

    await waitFor(() => {
      expect(createMutation.mutateAsync).toHaveBeenCalled();
    });

    expect(screen.getByText(i18n.t('cookbooks.addNotes'))).toBeTruthy();
  });
});

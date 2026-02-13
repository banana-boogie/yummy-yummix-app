import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/utils/render';
import { CookbookHeader } from '../CookbookHeader';
import i18n from '@/i18n';

jest.mock('@/hooks/useCookbookQuery', () => ({
  useUpdateCookbook: jest.fn(),
  useDeleteCookbook: jest.fn(),
}));

const { useUpdateCookbook, useDeleteCookbook } =
  require('@/hooks/useCookbookQuery');

describe('CookbookHeader', () => {
  const baseCookbook = {
    id: 'cb-1',
    userId: 'user-1',
    name: 'Family',
    description: 'Family favorites',
    isPublic: false,
    isDefault: false,
    shareEnabled: false,
    shareToken: 'token-1',
    recipeCount: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useUpdateCookbook.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    useDeleteCookbook.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  });

  it('shows edit/delete actions for owner and keeps sharing UI hidden', () => {
    renderWithProviders(
      <CookbookHeader cookbook={baseCookbook} isOwner={true} />
    );

    expect(screen.getByLabelText(i18n.t('cookbooks.a11y.editCookbook'))).toBeTruthy();
    expect(screen.getByLabelText(i18n.t('cookbooks.a11y.deleteCookbook'))).toBeTruthy();
    expect(screen.queryByLabelText(i18n.t('cookbooks.a11y.shareCookbook'))).toBeNull();
  });

  it('hides mutation actions for non-owner', () => {
    renderWithProviders(
      <CookbookHeader cookbook={baseCookbook} isOwner={false} />
    );

    expect(screen.queryByLabelText(i18n.t('cookbooks.a11y.editCookbook'))).toBeNull();
    expect(screen.queryByLabelText(i18n.t('cookbooks.a11y.deleteCookbook'))).toBeNull();
    expect(screen.queryByLabelText(i18n.t('cookbooks.a11y.shareCookbook'))).toBeNull();
  });

  it('calls onDelete once after confirmed delete', async () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    const onDelete = jest.fn();
    useDeleteCookbook.mockReturnValue({ mutateAsync, isPending: false });

    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const deleteAction = buttons?.find(
          (button) => button?.style === 'destructive'
        );
        deleteAction?.onPress?.();
      });

    renderWithProviders(
      <CookbookHeader cookbook={baseCookbook} isOwner={true} onDelete={onDelete} />
    );

    fireEvent.press(screen.getByLabelText(i18n.t('cookbooks.a11y.deleteCookbook')));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('cb-1');
    });
    expect(onDelete).toHaveBeenCalledTimes(1);

    alertSpy.mockRestore();
  });
});

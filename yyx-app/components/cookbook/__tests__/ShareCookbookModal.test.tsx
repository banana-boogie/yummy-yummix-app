import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/utils/render';
import { ShareCookbookModal } from '../ShareCookbookModal';
import i18n from '@/i18n';

jest.mock('@/hooks/useCookbookQuery', () => ({
  useRegenerateShareToken: jest.fn(),
  useUpdateCookbook: jest.fn(),
}));

jest.mock('@/utils/urls', () => ({
  getAppBaseUrl: () => 'https://staging.yummyyummix.com',
}));


const { useRegenerateShareToken, useUpdateCookbook } =
  require('@/hooks/useCookbookQuery');

describe('ShareCookbookModal', () => {
  const baseCookbook = {
    id: 'cb-1',
    userId: 'user-1',
    name: 'Family',
    description: 'Family favorites',
    isPublic: false,
    isDefault: false,
    shareEnabled: false,
    shareToken: 'token-1',
    recipeCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows placeholder and disables share when sharing is off', () => {
    useRegenerateShareToken.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    useUpdateCookbook.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    renderWithProviders(
      <ShareCookbookModal visible onClose={jest.fn()} cookbook={baseCookbook} />
    );

    expect(screen.getByText(i18n.t('cookbooks.shareDisabledPlaceholder'))).toBeTruthy();

    const shareButton = screen.getByLabelText(i18n.t('cookbooks.a11y.copyLink'));
    expect(shareButton.props.accessibilityState.disabled).toBe(true);
  });

  it('enables sharing and updates link when toggled on', async () => {
    const regenerate = jest.fn().mockResolvedValue('new-token');
    useRegenerateShareToken.mockReturnValue({ mutateAsync: regenerate, isPending: false });
    useUpdateCookbook.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    renderWithProviders(
      <ShareCookbookModal visible onClose={jest.fn()} cookbook={baseCookbook} />
    );

    const toggle = screen.getByRole('switch');
    fireEvent(toggle, 'valueChange', true);

    await waitFor(() => {
      expect(regenerate).toHaveBeenCalledWith('cb-1');
    });

    expect(
      screen.getByText('https://staging.yummyyummix.com/shared/cookbook/new-token')
    ).toBeTruthy();
  });

  it('disables sharing when toggled off', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    useRegenerateShareToken.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    useUpdateCookbook.mockReturnValue({ mutateAsync: update, isPending: false });

    renderWithProviders(
      <ShareCookbookModal
        visible
        onClose={jest.fn()}
        cookbook={{ ...baseCookbook, shareEnabled: true }}
      />
    );

    const toggle = screen.getByRole('switch');
    fireEvent(toggle, 'valueChange', false);

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({
        cookbookId: 'cb-1',
        input: { shareEnabled: false },
      });
    });

    expect(screen.getByText(i18n.t('cookbooks.shareDisabledPlaceholder'))).toBeTruthy();
  });
});

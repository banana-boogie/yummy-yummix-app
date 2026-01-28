/**
 * OfflineBanner Tests
 *
 * Ensures offline/syncing states render correctly.
 */

import React from 'react';
import { render, screen } from '@/test/utils/render';
import { OfflineBanner } from '../OfflineBanner';
import i18n from '@/i18n';

describe('OfflineBanner', () => {
  it('renders nothing when online and not syncing', () => {
    const { queryByText } = render(
      <OfflineBanner isOffline={false} isSyncing={false} />
    );

    expect(queryByText(i18n.t('shoppingList.offline'))).toBeNull();
  });

  it('shows offline message and pending count', () => {
    render(<OfflineBanner isOffline pendingCount={2} />);

    expect(screen.getByText(i18n.t('shoppingList.offline'))).toBeTruthy();
    expect(
      screen.getByText(i18n.t('shoppingList.pendingChanges', { count: 2 }))
    ).toBeTruthy();
  });
});


import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { VerificationCard } from '../VerificationCard';

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        'admin.recipes.form.myWeekSetup.verified.label': 'YummyYummix Verified',
        'admin.recipes.form.myWeekSetup.verified.tooltip': 'Turn on if cooked by team.',
        'admin.recipes.form.myWeekSetup.verified.markVerifiedCta': 'Mark verified',
        'admin.recipes.form.myWeekSetup.verified.unverifyCta': 'Remove verification',
      };
      if (key === 'admin.recipes.form.myWeekSetup.verified.verifiedAt') {
        return `Verified on ${params?.date ?? ''}`;
      }
      if (key === 'admin.recipes.form.myWeekSetup.verified.verifiedBy') {
        return ` by ${params?.who ?? ''}`;
      }
      return map[key] ?? key;
    },
  },
}));

describe('VerificationCard', () => {
  it('renders unverified state and calls onMarkVerified', () => {
    const onMark = jest.fn();
    render(
      <VerificationCard
        verifiedAt={null}
        verifiedBy={null}
        displayLocale="en"
        onMarkVerified={onMark}
        onUnverify={() => {}}
      />,
    );
    expect(screen.getByText('YummyYummix Verified')).toBeTruthy();
    fireEvent.press(screen.getByText('Mark verified'));
    expect(onMark).toHaveBeenCalled();
  });

  it('renders verified state with date and calls onUnverify', () => {
    const onUnverify = jest.fn();
    render(
      <VerificationCard
        verifiedAt="2026-04-13T00:00:00.000Z"
        verifiedBy="user-123"
        displayLocale="en"
        onMarkVerified={() => {}}
        onUnverify={onUnverify}
      />,
    );
    expect(screen.getByText('YummyYummix Verified')).toBeTruthy();
    fireEvent.press(screen.getByText('Remove verification'));
    expect(onUnverify).toHaveBeenCalled();
  });

  it('does not append by-line when verifiedBy is null', () => {
    render(
      <VerificationCard
        verifiedAt="2026-04-13T00:00:00.000Z"
        verifiedBy={null}
        displayLocale="en"
        onMarkVerified={() => {}}
        onUnverify={() => {}}
      />,
    );
    // "Mark verified" should not be shown in verified state
    expect(screen.queryByText('Mark verified')).toBeNull();
    expect(screen.getByText('Remove verification')).toBeTruthy();
  });
});

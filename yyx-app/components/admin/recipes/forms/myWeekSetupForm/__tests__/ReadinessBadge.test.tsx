import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ReadinessBadge } from '../ReadinessBadge';

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'admin.recipes.form.myWeekSetup.eligibility.ready') return 'Ready';
      if (key === 'admin.recipes.form.myWeekSetup.eligibility.missingTitle') return 'Missing info';
      if (key === 'admin.recipes.form.myWeekSetup.eligibility.needHelper') return 'Complete these:';
      if (key === 'admin.recipes.form.myWeekSetup.eligibility.jumpToField') {
        return `Jump to ${params?.field ?? ''}`;
      }
      if (key === 'admin.recipes.form.myWeekSetup.eligibility.pantryTitle') {
        return 'Pantry item — Explore only';
      }
      if (key === 'admin.recipes.form.myWeekSetup.eligibility.pantryHelper') {
        return 'Not scheduled into weekly plans.';
      }
      return key;
    },
  },
}));

describe('ReadinessBadge', () => {
  it('renders ready state when isReady', () => {
    render(<ReadinessBadge isReady missing={[]} />);
    expect(screen.getByText('Ready')).toBeTruthy();
  });

  it('renders missing chips when not ready', () => {
    render(
      <ReadinessBadge
        isReady={false}
        missing={[
          { anchor: 'plannerRole', label: 'recipe role' },
          { anchor: 'mealComponents', label: 'what it contributes' },
        ]}
      />,
    );
    expect(screen.getByText('Missing info')).toBeTruthy();
    expect(screen.getByText('Complete these:')).toBeTruthy();
    expect(screen.getByText('recipe role →')).toBeTruthy();
    expect(screen.getByText('what it contributes →')).toBeTruthy();
  });

  it('renders neutral pantry state when isPantry is true', () => {
    render(<ReadinessBadge isReady={false} isPantry missing={[]} />);
    expect(screen.getByText('Pantry item — Explore only')).toBeTruthy();
    expect(screen.getByText('Not scheduled into weekly plans.')).toBeTruthy();
  });

  it('calls onJumpToField with anchor when chip pressed', () => {
    const onJump = jest.fn();
    render(
      <ReadinessBadge
        isReady={false}
        missing={[{ anchor: 'mealTypes', label: 'meal types' }]}
        onJumpToField={onJump}
      />,
    );
    fireEvent.press(screen.getByLabelText('Jump to meal types'));
    expect(onJump).toHaveBeenCalledWith('mealTypes');
  });

  it('does not crash when onJumpToField is omitted', () => {
    render(
      <ReadinessBadge
        isReady={false}
        missing={[{ anchor: 'plannerRole', label: 'recipe role' }]}
      />,
    );
    fireEvent.press(screen.getByLabelText('Jump to recipe role'));
  });
});

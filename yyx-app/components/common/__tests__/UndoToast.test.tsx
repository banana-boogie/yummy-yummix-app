/**
 * UndoToast Tests
 *
 * Validates the imperative show/hide API and Undo interaction.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { UndoToastHost, showUndoToast, hideUndoToast } from '../UndoToast';

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(() => Promise.resolve()),
    notificationAsync: jest.fn(() => Promise.resolve()),
    ImpactFeedbackStyle: { Medium: 'medium' },
    NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('UndoToast', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        act(() => {
            jest.runOnlyPendingTimers();
        });
        jest.useRealTimers();
    });

    it('renders nothing initially', () => {
        render(<UndoToastHost />);
        expect(screen.queryByText('Undo')).toBeNull();
    });

    it('shows the toast when showUndoToast is called', () => {
        render(<UndoToastHost />);
        act(() => {
            showUndoToast({ message: 'Item deleted', onUndo: jest.fn() });
        });
        expect(screen.getByText('Item deleted')).toBeTruthy();
        expect(screen.getByText('Undo')).toBeTruthy();
    });

    it('calls onUndo and hides when Undo is pressed', () => {
        const onUndo = jest.fn();
        render(<UndoToastHost />);
        act(() => {
            showUndoToast({ message: 'Item deleted', onUndo });
        });

        fireEvent.press(screen.getByText('Undo'));
        // Animation tick to completion
        act(() => {
            jest.runAllTimers();
        });

        expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('hides without calling onUndo when × is pressed', () => {
        const onUndo = jest.fn();
        render(<UndoToastHost />);
        act(() => {
            showUndoToast({ message: 'Item deleted', onUndo });
        });

        fireEvent.press(screen.getByLabelText('Dismiss'));
        act(() => {
            jest.runAllTimers();
        });

        expect(onUndo).not.toHaveBeenCalled();
        expect(screen.queryByText('Item deleted')).toBeNull();
    });

    it('auto-hides after the specified duration', () => {
        const onUndo = jest.fn();
        render(<UndoToastHost />);
        act(() => {
            showUndoToast({ message: 'Item deleted', onUndo, duration: 5000 });
        });
        expect(screen.getByText('Item deleted')).toBeTruthy();

        act(() => {
            jest.advanceTimersByTime(5000);
        });
        // Run animation timers to complete the fade-out
        act(() => {
            jest.runAllTimers();
        });

        expect(screen.queryByText('Item deleted')).toBeNull();
        expect(onUndo).not.toHaveBeenCalled();
    });

    it('replaces the message and resets the timer when called again', () => {
        const firstUndo = jest.fn();
        const secondUndo = jest.fn();
        render(<UndoToastHost />);
        act(() => {
            showUndoToast({ message: 'First', onUndo: firstUndo, duration: 5000 });
        });
        // Partway through
        act(() => {
            jest.advanceTimersByTime(3000);
        });
        // Second toast resets timer
        act(() => {
            showUndoToast({ message: 'Second', onUndo: secondUndo, duration: 5000 });
        });
        expect(screen.getByText('Second')).toBeTruthy();

        // The first timer should not fire — we're 3000ms into the original 5000ms.
        // After 3000ms more total, the second toast (5000ms) should still be visible.
        act(() => {
            jest.advanceTimersByTime(3000);
        });
        expect(screen.getByText('Second')).toBeTruthy();
    });

    it('hideUndoToast hides the visible toast', () => {
        render(<UndoToastHost />);
        act(() => {
            showUndoToast({ message: 'Item deleted', onUndo: jest.fn() });
        });
        act(() => {
            hideUndoToast();
            jest.runAllTimers();
        });
        expect(screen.queryByText('Item deleted')).toBeNull();
    });
});

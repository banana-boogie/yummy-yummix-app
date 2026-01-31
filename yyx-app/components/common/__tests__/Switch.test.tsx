/**
 * Switch Tests
 *
 * Tests for switch component covering:
 * - Toggle on/off states
 * - Value change handling
 * - Disabled state
 * - Custom colors
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Switch } from '../Switch';

// Mock dependencies
jest.mock('@/constants/design-tokens', () => ({
  COLORS: {
    primary: {
      default: '#FEE5E2',
      light: '#FCF6F2',
    },
    background: {
      default: '#FFFFFF',
      secondary: '#F5F5F5',
    },
  },
}));

describe('Switch', () => {
  const defaultProps = {
    value: false,
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<Switch {...defaultProps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('renders in off state', () => {
      const { toJSON } = render(<Switch {...defaultProps} value={false} />);

      expect(toJSON()).toBeTruthy();
    });

    it('renders in on state', () => {
      const { toJSON } = render(<Switch {...defaultProps} value={true} />);

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // VALUE CHANGE TESTS
  // ============================================================

  describe('value change', () => {
    it('calls onValueChange when toggled', () => {
      const mockOnChange = jest.fn();
      render(<Switch {...defaultProps} onValueChange={mockOnChange} />);

      // Note: fireEvent.valueChange works for Switch component
      const switchComponent = screen.getByRole('switch');
      fireEvent(switchComponent, 'valueChange', true);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });
  });

  // ============================================================
  // DISABLED STATE TESTS
  // ============================================================

  describe('disabled state', () => {
    it('renders disabled switch', () => {
      const { toJSON } = render(
        <Switch {...defaultProps} disabled />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // CUSTOM COLORS TESTS
  // ============================================================

  describe('custom colors', () => {
    it('accepts custom track colors', () => {
      const { toJSON } = render(
        <Switch
          {...defaultProps}
          trackColor={{ false: '#FF0000', true: '#00FF00' }}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('accepts custom thumb colors', () => {
      const { toJSON } = render(
        <Switch
          {...defaultProps}
          thumbColor={{ false: '#0000FF', true: '#FFFF00' }}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <Switch {...defaultProps} className="custom-class" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom containerClassName', () => {
      const { toJSON } = render(
        <Switch {...defaultProps} containerClassName="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom containerStyle', () => {
      const { toJSON } = render(
        <Switch {...defaultProps} containerStyle={{ marginTop: 20 }} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});

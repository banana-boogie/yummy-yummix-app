/**
 * Text Component Tests
 *
 * Basic tests for the Text component.
 * See components/common/__tests__/Button.test.tsx for more comprehensive examples.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from '@/components/common/Text';

describe('Text', () => {
  it('renders text content', () => {
    render(<Text>Hello World</Text>);
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('renders with preset', () => {
    render(<Text preset="h1">Heading</Text>);
    expect(screen.getByText('Heading')).toBeTruthy();
  });
});

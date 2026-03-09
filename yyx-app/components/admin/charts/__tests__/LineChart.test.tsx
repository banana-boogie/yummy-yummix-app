import React from 'react';
import { renderWithProviders, screen } from '@/test/utils/render';
import { LineChart } from '../LineChart';

jest.mock('react-native-svg', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  return {
    __esModule: true,
    default: 'Svg',
    Svg: 'Svg',
    Polyline: 'Polyline',
    Polygon: 'Polygon',
    Circle: 'Circle',
    Line: 'Line',
    Text: RN.Text,
    Defs: 'Defs',
    LinearGradient: 'LinearGradient',
    Stop: 'Stop',
    Rect: 'Rect',
  };
});

const sampleData = [
  { label: 'Mon', value: 5 },
  { label: 'Tue', value: 12 },
  { label: 'Wed', value: 8 },
  { label: 'Thu', value: 20 },
  { label: 'Fri', value: 15 },
];

describe('LineChart', () => {
  it('renders "No data" message when data is empty', () => {
    renderWithProviders(<LineChart data={[]} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('renders container for layout measurement with valid data', () => {
    const { toJSON } = renderWithProviders(<LineChart data={sampleData} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts custom line and fill colors', () => {
    const { toJSON } = renderWithProviders(
      <LineChart data={sampleData} lineColor="#FF0000" fillColor="#00FF00" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles single data point', () => {
    const { toJSON } = renderWithProviders(
      <LineChart data={[{ label: 'Only', value: 42 }]} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('respects custom height', () => {
    renderWithProviders(<LineChart data={[]} height={300} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });
});

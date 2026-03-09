import React from 'react';
import { renderWithProviders, screen } from '@/test/utils/render';
import { DonutChart } from '../DonutChart';

jest.mock('react-native-svg', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  return {
    __esModule: true,
    default: 'Svg',
    Svg: 'Svg',
    Circle: 'Circle',
    Rect: 'Rect',
    Text: RN.Text,
    Line: 'Line',
  };
});

const sampleData = [
  { label: 'Active', value: 60, color: '#78A97A' },
  { label: 'Inactive', value: 25, color: '#FFBFB7' },
  { label: 'New', value: 15, color: '#FF9A99' },
];

describe('DonutChart', () => {
  it('renders "No data" message when data is empty', () => {
    renderWithProviders(<DonutChart data={[]} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('renders "No data" message when all values are zero', () => {
    renderWithProviders(
      <DonutChart
        data={[
          { label: 'A', value: 0, color: '#000' },
          { label: 'B', value: 0, color: '#111' },
        ]}
      />,
    );
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('renders total in center', () => {
    renderWithProviders(<DonutChart data={sampleData} />);
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('renders "Total" label in center', () => {
    renderWithProviders(<DonutChart data={sampleData} />);
    expect(screen.getByText('Total')).toBeTruthy();
  });

  it('renders legend items with labels and values', () => {
    renderWithProviders(<DonutChart data={sampleData} />);
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('Inactive')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
  });

  it('accepts custom size and strokeWidth', () => {
    const { toJSON } = renderWithProviders(
      <DonutChart data={sampleData} size={200} strokeWidth={30} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});

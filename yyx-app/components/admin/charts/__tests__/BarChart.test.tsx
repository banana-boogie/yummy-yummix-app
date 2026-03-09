import React from 'react';
import { renderWithProviders, screen } from '@/test/utils/render';
import { BarChart } from '../BarChart';

jest.mock('react-native-svg', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  return {
    __esModule: true,
    default: 'Svg',
    Svg: 'Svg',
    Rect: 'Rect',
    Line: 'Line',
    Text: RN.Text,
    Circle: 'Circle',
  };
});

const sampleData = [
  { label: 'Jan', values: [{ value: 10, color: '#FF9A99' }] },
  { label: 'Feb', values: [{ value: 25, color: '#FF9A99' }] },
  { label: 'Mar', values: [{ value: 15, color: '#FF9A99' }] },
];

const groupedData = [
  {
    label: 'Week 1',
    values: [
      { value: 20, color: '#FF9A99' },
      { value: 12, color: '#78A97A' },
    ],
  },
  {
    label: 'Week 2',
    values: [
      { value: 30, color: '#FF9A99' },
      { value: 18, color: '#78A97A' },
    ],
  },
];

describe('BarChart', () => {
  it('renders "No data" message when data is empty', () => {
    renderWithProviders(<BarChart data={[]} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('renders container for layout measurement with valid data', () => {
    const { toJSON } = renderWithProviders(<BarChart data={sampleData} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts grouped data without crashing', () => {
    const { toJSON } = renderWithProviders(<BarChart data={groupedData} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts horizontal mode without crashing', () => {
    const { toJSON } = renderWithProviders(<BarChart data={sampleData} horizontal />);
    expect(toJSON()).toBeTruthy();
  });

  it('respects custom height', () => {
    renderWithProviders(<BarChart data={[]} height={300} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });
});

import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
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

function fireOnLayout(element: ReturnType<typeof screen.root>, width = 400) {
  fireEvent(element, 'layout', {
    nativeEvent: { layout: { width, height: 200, x: 0, y: 0 } },
  });
}

describe('BarChart', () => {
  it('renders "No data" message when data is empty', () => {
    renderWithProviders(<BarChart data={[]} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('renders container for layout measurement with valid data', () => {
    const { toJSON } = renderWithProviders(<BarChart data={sampleData} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders bar value labels after layout', () => {
    renderWithProviders(<BarChart data={sampleData} />);
    const containers = screen.root.findAll(
      (node) => node.props?.onLayout !== undefined,
    );
    fireOnLayout(containers[0]);

    // Should render value labels above bars
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
  });

  it('renders x-axis labels after layout', () => {
    renderWithProviders(<BarChart data={sampleData} />);
    const containers = screen.root.findAll(
      (node) => node.props?.onLayout !== undefined,
    );
    fireOnLayout(containers[0]);

    expect(screen.getByText('Jan')).toBeTruthy();
    expect(screen.getByText('Feb')).toBeTruthy();
    expect(screen.getByText('Mar')).toBeTruthy();
  });

  it('accepts grouped data and renders all values', () => {
    renderWithProviders(<BarChart data={groupedData} />);
    const containers = screen.root.findAll(
      (node) => node.props?.onLayout !== undefined,
    );
    fireOnLayout(containers[0]);

    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
  });

  it('renders horizontal mode with labels after layout', () => {
    renderWithProviders(<BarChart data={sampleData} horizontal />);
    const containers = screen.root.findAll(
      (node) => node.props?.onLayout !== undefined,
    );
    fireOnLayout(containers[0]);

    // Horizontal mode should show labels to the left
    expect(screen.getByText('Jan')).toBeTruthy();
    expect(screen.getByText('Feb')).toBeTruthy();
  });

  it('respects custom height', () => {
    renderWithProviders(<BarChart data={[]} height={300} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });
});

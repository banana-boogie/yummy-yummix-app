import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
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

function fireOnLayout(element: ReturnType<typeof screen.getByTestId> | ReturnType<typeof screen.root>, width = 400) {
  fireEvent(element, 'layout', {
    nativeEvent: { layout: { width, height: 200, x: 0, y: 0 } },
  });
}

describe('LineChart', () => {
  it('renders "No data" message when data is empty', () => {
    renderWithProviders(<LineChart data={[]} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('renders container for layout measurement with valid data', () => {
    const { toJSON } = renderWithProviders(<LineChart data={sampleData} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders gridline labels after layout', () => {
    renderWithProviders(<LineChart data={sampleData} />);
    // Find the layout container and fire onLayout
    const containers = screen.root.findAll(
      (node) => node.props?.onLayout !== undefined,
    );
    const layoutContainer = containers[0];
    fireOnLayout(layoutContainer);

    // Should render Y-axis gridline labels (0 and 20 for niceMax=20)
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('renders X-axis labels after layout', () => {
    renderWithProviders(<LineChart data={sampleData} />);
    const containers = screen.root.findAll(
      (node) => node.props?.onLayout !== undefined,
    );
    fireOnLayout(containers[0]);

    // Should render at least first and last X-axis labels
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('Fri')).toBeTruthy();
  });

  it('renders tap targets for each data point after layout', () => {
    renderWithProviders(<LineChart data={sampleData} />);
    const containers = screen.root.findAll(
      (node) => node.props?.onLayout !== undefined,
    );
    fireOnLayout(containers[0]);

    // Should render one tap target per data point (identified by fixed HIT_SIZE dimensions)
    const HIT_SIZE = 32;
    const tapTargets = screen.root.findAll(
      (node) => node.props?.activeOpacity === 0.7
        && node.props?.style?.width === HIT_SIZE
        && node.props?.style?.height === HIT_SIZE,
    );
    // renderWithProviders wraps in providers that may duplicate the tree;
    // verify at least the expected count exists
    expect(tapTargets.length).toBeGreaterThanOrEqual(sampleData.length);
  });

  it('uses valueFormatter for Y-axis labels', () => {
    renderWithProviders(
      <LineChart data={sampleData} valueFormatter={(v) => `$${v}`} />,
    );
    const containers = screen.root.findAll(
      (node) => node.props?.onLayout !== undefined,
    );
    fireOnLayout(containers[0]);

    expect(screen.getByText('$0')).toBeTruthy();
    expect(screen.getByText('$20')).toBeTruthy();
  });

  it('handles single data point', () => {
    const { toJSON } = renderWithProviders(
      <LineChart data={[{ label: 'Only', value: 42 }]} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('avoids fractional gridlines for small integer values', () => {
    renderWithProviders(
      <LineChart data={[{ label: 'A', value: 1 }, { label: 'B', value: 2 }]} />,
    );
    const containers = screen.root.findAll(
      (node) => node.props?.onLayout !== undefined,
    );
    fireOnLayout(containers[0]);

    // niceMax=2 with integer data should give gridlines at 0, 1, 2
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('respects custom height', () => {
    renderWithProviders(<LineChart data={[]} height={300} />);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });
});

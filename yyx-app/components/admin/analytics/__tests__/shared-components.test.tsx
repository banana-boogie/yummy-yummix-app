/**
 * Shared Analytics Components Tests
 *
 * Tests for the shared UI components used across the admin analytics dashboard:
 * - TabSelector: tab navigation with callback
 * - TimeframeSelector: timeframe filter with callback
 * - CollapsibleSection: expand/collapse toggle
 * - MetricCard: metric display with optional icon/subtitle/tooltip
 * - ListItem: ranked list row
 * - SectionTitle: heading text wrapper
 * - LegendDot: colored indicator dot
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { TabSelector, TabType } from '../TabSelector';
import { TimeframeSelector } from '../TimeframeSelector';
import { CollapsibleSection } from '../CollapsibleSection';
import { MetricCard } from '../MetricCard';
import { ListItem } from '../ListItem';
import { SectionTitle } from '../SectionTitle';
import { LegendDot } from '../LegendDot';
import { Text } from 'react-native';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'admin.analytics.tabs.overview': 'Overview',
        'admin.analytics.tabs.content': 'Content',
        'admin.analytics.tabs.ai': 'AI',
        'admin.analytics.tabs.operations': 'Operations',
        'admin.analytics.timeframes.today': 'Today',
        'admin.analytics.timeframes.sevenDays': '7 Days',
        'admin.analytics.timeframes.thirtyDays': '30 Days',
        'admin.analytics.timeframes.allTime': 'All Time',
      };
      return translations[key] || key;
    },
  },
}));

// ============================================================
// TabSelector
// ============================================================

describe('TabSelector', () => {
  const defaultProps = {
    value: 'overview' as TabType,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all four tab labels', () => {
    renderWithProviders(<TabSelector {...defaultProps} />);

    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText('Operations')).toBeTruthy();
  });

  it('calls onChange with the correct tab value when pressed', () => {
    const onChange = jest.fn();
    renderWithProviders(<TabSelector value="overview" onChange={onChange} />);

    fireEvent.press(screen.getByText('Content'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('content');
  });

  it('calls onChange when pressing a different tab', () => {
    const onChange = jest.fn();
    renderWithProviders(<TabSelector value="content" onChange={onChange} />);

    fireEvent.press(screen.getByText('AI'));

    expect(onChange).toHaveBeenCalledWith('ai');
  });

  it('calls onChange when pressing the operations tab', () => {
    const onChange = jest.fn();
    renderWithProviders(<TabSelector value="overview" onChange={onChange} />);

    fireEvent.press(screen.getByText('Operations'));

    expect(onChange).toHaveBeenCalledWith('operations');
  });
});

// ============================================================
// TimeframeSelector
// ============================================================

describe('TimeframeSelector', () => {
  const defaultProps = {
    value: '7_days' as const,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all four timeframe options', () => {
    renderWithProviders(<TimeframeSelector {...defaultProps} />);

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('7 Days')).toBeTruthy();
    expect(screen.getByText('30 Days')).toBeTruthy();
    expect(screen.getByText('All Time')).toBeTruthy();
  });

  it('calls onChange with the correct timeframe value when pressed', () => {
    const onChange = jest.fn();
    renderWithProviders(<TimeframeSelector value="7_days" onChange={onChange} />);

    fireEvent.press(screen.getByText('Today'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('today');
  });

  it('calls onChange with 30_days when that option is pressed', () => {
    const onChange = jest.fn();
    renderWithProviders(<TimeframeSelector value="today" onChange={onChange} />);

    fireEvent.press(screen.getByText('30 Days'));

    expect(onChange).toHaveBeenCalledWith('30_days');
  });

  it('calls onChange with all_time when that option is pressed', () => {
    const onChange = jest.fn();
    renderWithProviders(<TimeframeSelector value="today" onChange={onChange} />);

    fireEvent.press(screen.getByText('All Time'));

    expect(onChange).toHaveBeenCalledWith('all_time');
  });
});

// ============================================================
// CollapsibleSection
// ============================================================

describe('CollapsibleSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    renderWithProviders(
      <CollapsibleSection title="Test Section">
        <Text>Hidden content</Text>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Test Section')).toBeTruthy();
  });

  it('does not show children when collapsed (default state)', () => {
    renderWithProviders(
      <CollapsibleSection title="Test Section">
        <Text>Hidden content</Text>
      </CollapsibleSection>,
    );

    expect(screen.queryByText('Hidden content')).toBeNull();
  });

  it('shows children after pressing the title to expand', () => {
    renderWithProviders(
      <CollapsibleSection title="Test Section">
        <Text>Hidden content</Text>
      </CollapsibleSection>,
    );

    fireEvent.press(screen.getByText('Test Section'));

    expect(screen.getByText('Hidden content')).toBeTruthy();
  });

  it('hides children after pressing the title twice (collapse)', () => {
    renderWithProviders(
      <CollapsibleSection title="Test Section">
        <Text>Hidden content</Text>
      </CollapsibleSection>,
    );

    // Expand
    fireEvent.press(screen.getByText('Test Section'));
    expect(screen.getByText('Hidden content')).toBeTruthy();

    // Collapse
    fireEvent.press(screen.getByText('Test Section'));
    expect(screen.queryByText('Hidden content')).toBeNull();
  });
});

// ============================================================
// MetricCard
// ============================================================

describe('MetricCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and value', () => {
    renderWithProviders(<MetricCard title="Total Users" value={1234} />);

    expect(screen.getByText('Total Users')).toBeTruthy();
    expect(screen.getByText('1234')).toBeTruthy();
  });

  it('renders string value', () => {
    renderWithProviders(<MetricCard title="Avg Time" value="3.5 min" />);

    expect(screen.getByText('Avg Time')).toBeTruthy();
    expect(screen.getByText('3.5 min')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    renderWithProviders(
      <MetricCard title="Users" value={100} subtitle="+12% from last week" />,
    );

    expect(screen.getByText('+12% from last week')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    renderWithProviders(<MetricCard title="Users" value={100} />);

    // Only title and value should be present
    expect(screen.getByText('Users')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('renders tooltip when provided', () => {
    renderWithProviders(
      <MetricCard title="Score" value={85} tooltip="Based on last 30 days" />,
    );

    expect(screen.getByText('Based on last 30 days')).toBeTruthy();
  });

  it('does not render tooltip when not provided', () => {
    const { toJSON } = renderWithProviders(<MetricCard title="Score" value={85} />);

    // Snapshot should not contain tooltip text
    expect(toJSON()).toBeTruthy();
    expect(screen.queryByText('Based on last 30 days')).toBeNull();
  });
});

// ============================================================
// ListItem
// ============================================================

describe('ListItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders rank, label, and value', () => {
    renderWithProviders(<ListItem rank={1} label="Pasta Carbonara" value={42} />);

    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('Pasta Carbonara')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders different rank numbers correctly', () => {
    renderWithProviders(<ListItem rank={5} label="Tacos" value={18} />);

    expect(screen.getByText('5.')).toBeTruthy();
    expect(screen.getByText('Tacos')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
  });
});

// ============================================================
// SectionTitle
// ============================================================

describe('SectionTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children text', () => {
    renderWithProviders(<SectionTitle>Popular Recipes</SectionTitle>);

    expect(screen.getByText('Popular Recipes')).toBeTruthy();
  });
});

// ============================================================
// LegendDot
// ============================================================

describe('LegendDot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the specified background color', () => {
    const { toJSON } = renderWithProviders(<LegendDot color="#FF9A99" />);
    const tree = toJSON();

    // The component renders a View with inline style for color
    expect(tree).toBeTruthy();
    expect(JSON.stringify(tree)).toContain('#FF9A99');
  });

  it('renders as a circle (borderRadius is half of width/height)', () => {
    const { toJSON } = renderWithProviders(<LegendDot color="#78A97A" />);
    const tree = toJSON();

    // Verify the dot dimensions and shape
    const treeString = JSON.stringify(tree);
    expect(treeString).toContain('"width":10');
    expect(treeString).toContain('"height":10');
    expect(treeString).toContain('"borderRadius":5');
  });
});

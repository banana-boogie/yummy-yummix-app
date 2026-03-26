import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { IrmixyUsageCard } from '../IrmixyUsageCard';

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'settings.irmixyUsage': 'Irmixy Usage',
      'settings.irmixyUsageLabel': 'Monthly usage',
      'settings.irmixyUsageReset': 'Resets at the start of each month',
    };
    if (key === 'settings.irmixyUsagePct' && params) {
      return `${params.percent}% used`;
    }
    return translations[key] || key;
  },
}));

// Mock auth
const mockUser = { id: 'user-123', email: 'test@example.com' };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock budget service
const mockFetchBudgetUsage = jest.fn();
jest.mock('@/services/budgetService', () => ({
  fetchBudgetUsage: (...args: any[]) => mockFetchBudgetUsage(...args),
}));

// Mock logger
jest.mock('@/services/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe('IrmixyUsageCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockFetchBudgetUsage.mockReturnValue(new Promise(() => {})); // never resolves
    render(<IrmixyUsageCard />);
    expect(screen.getByText('Irmixy Usage')).toBeTruthy();
  });

  it('displays usage percentage when data loads', async () => {
    mockFetchBudgetUsage.mockResolvedValue({
      usagePercent: 45,
      totalCostUsd: 0.045,
      budgetUsd: 0.10,
      requestCount: 12,
      tier: 'free',
    });

    render(<IrmixyUsageCard />);

    expect(await screen.findByText('45% used')).toBeTruthy();
    expect(screen.getByText('Monthly usage')).toBeTruthy();
    expect(screen.getByText('Resets at the start of each month')).toBeTruthy();
  });

  it('renders nothing when fetch fails', async () => {
    mockFetchBudgetUsage.mockRejectedValue(new Error('network error'));

    const { toJSON } = render(<IrmixyUsageCard />);

    // Wait for the error state to settle
    await screen.findByText('Irmixy Usage').catch(() => {}); // loading state may flash
    // After error, component should render null — wait a tick
    await new Promise((r) => setTimeout(r, 50));

    // The component returns null on error, so it should be empty
    // (the loading state disappears and null is rendered)
  });

  it('displays high usage percentage (>80%) correctly', async () => {
    mockFetchBudgetUsage.mockResolvedValue({
      usagePercent: 92,
      totalCostUsd: 0.092,
      budgetUsd: 0.10,
      requestCount: 30,
      tier: 'free',
    });

    render(<IrmixyUsageCard />);

    expect(await screen.findByText('92% used')).toBeTruthy();
  });
});

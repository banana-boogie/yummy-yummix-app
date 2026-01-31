/**
 * MeasurementContext Tests
 *
 * Tests for measurement context covering:
 * - Default measurement system
 * - Measurement switching
 * - Persistence
 * - Context hooks
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { MeasurementProvider, useMeasurement } from '../MeasurementContext';
import { MeasurementSystem } from '@/types/user';

// Mock Storage
const mockStorage: Record<string, string | null> = {};
jest.mock('@/utils/storage', () => ({
  Storage: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

describe('MeasurementContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MeasurementProvider>{children}</MeasurementProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  // ============================================================
  // INITIALIZATION TESTS
  // ============================================================

  describe('initialization', () => {
    it('defaults to metric system', () => {
      const { result } = renderHook(() => useMeasurement(), { wrapper });

      expect(result.current.measurementSystem).toBe(MeasurementSystem.METRIC);
    });

    it('loads saved measurement preference', async () => {
      const { Storage } = require('@/utils/storage');
      Storage.getItem.mockResolvedValueOnce(MeasurementSystem.IMPERIAL);

      const { result } = renderHook(() => useMeasurement(), { wrapper });

      await waitFor(() => {
        expect(result.current.measurementSystem).toBe(MeasurementSystem.IMPERIAL);
      });
    });

    it('uses metric when storage returns null', async () => {
      const { Storage } = require('@/utils/storage');
      Storage.getItem.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useMeasurement(), { wrapper });

      await waitFor(() => {
        expect(Storage.getItem).toHaveBeenCalledWith('measurementSystem');
      });

      expect(result.current.measurementSystem).toBe(MeasurementSystem.METRIC);
    });
  });

  // ============================================================
  // MEASUREMENT SWITCHING TESTS
  // ============================================================

  describe('setMeasurementSystem', () => {
    it('switches to imperial system', async () => {
      const { result } = renderHook(() => useMeasurement(), { wrapper });

      await act(async () => {
        await result.current.setMeasurementSystem(MeasurementSystem.IMPERIAL);
      });

      expect(result.current.measurementSystem).toBe(MeasurementSystem.IMPERIAL);
    });

    it('switches to metric system', async () => {
      const { Storage } = require('@/utils/storage');
      Storage.getItem.mockResolvedValueOnce(MeasurementSystem.IMPERIAL);

      const { result } = renderHook(() => useMeasurement(), { wrapper });

      await waitFor(() => {
        expect(result.current.measurementSystem).toBe(MeasurementSystem.IMPERIAL);
      });

      await act(async () => {
        await result.current.setMeasurementSystem(MeasurementSystem.METRIC);
      });

      expect(result.current.measurementSystem).toBe(MeasurementSystem.METRIC);
    });

    it('persists measurement preference to storage', async () => {
      const { Storage } = require('@/utils/storage');
      const { result } = renderHook(() => useMeasurement(), { wrapper });

      await act(async () => {
        await result.current.setMeasurementSystem(MeasurementSystem.IMPERIAL);
      });

      expect(Storage.setItem).toHaveBeenCalledWith(
        'measurementSystem',
        MeasurementSystem.IMPERIAL
      );
    });

    it('updates state and persists to storage', async () => {
      const { Storage } = require('@/utils/storage');
      const { result } = renderHook(() => useMeasurement(), { wrapper });

      await act(async () => {
        await result.current.setMeasurementSystem(MeasurementSystem.IMPERIAL);
      });

      // State should be updated
      expect(result.current.measurementSystem).toBe(MeasurementSystem.IMPERIAL);

      // Storage should be called
      expect(Storage.setItem).toHaveBeenCalledWith(
        'measurementSystem',
        MeasurementSystem.IMPERIAL
      );
    });
  });

  // ============================================================
  // HOOK VALIDATION TESTS
  // ============================================================

  describe('useMeasurement hook', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useMeasurement());
      }).toThrow('useMeasurement must be used within a MeasurementProvider');

      consoleSpy.mockRestore();
    });

    it('provides setMeasurementSystem function', () => {
      const { result } = renderHook(() => useMeasurement(), { wrapper });

      expect(typeof result.current.setMeasurementSystem).toBe('function');
    });
  });
});

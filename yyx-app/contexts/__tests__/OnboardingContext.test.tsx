/**
 * OnboardingContext Tests
 *
 * Tests for onboarding context covering:
 * - Step navigation
 * - Form data management
 * - State persistence
 * - Reset functionality
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { OnboardingProvider, useOnboarding } from '../OnboardingContext';

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

describe('OnboardingContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <OnboardingProvider>{children}</OnboardingProvider>
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
    it('starts at step 0', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      expect(result.current.currentStep).toBe(0);
    });

    it('starts with empty form data', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      expect(result.current.formData).toEqual({});
    });

    it('has correct total steps', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      expect(result.current.totalSteps).toBe(5);
    });

    it('loads saved state from storage', async () => {
      const { Storage } = require('@/utils/storage');
      const savedState = {
        step: 2,
        data: { name: 'Test User' },
      };
      Storage.getItem.mockResolvedValueOnce(JSON.stringify(savedState));

      const { result } = renderHook(() => useOnboarding(), { wrapper });

      await waitFor(() => {
        expect(result.current.currentStep).toBe(2);
        expect(result.current.formData).toEqual({ name: 'Test User' });
      });
    });

    it('handles invalid saved state gracefully', async () => {
      const { Storage } = require('@/utils/storage');
      Storage.getItem.mockResolvedValueOnce('invalid json');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useOnboarding(), { wrapper });

      await waitFor(() => {
        expect(Storage.getItem).toHaveBeenCalled();
      });

      // Should remain at defaults
      expect(result.current.currentStep).toBe(0);

      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // STEP NAVIGATION TESTS
  // ============================================================

  describe('step navigation', () => {
    it('goToNextStep increments current step', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('goToNextStep does not exceed total steps', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      // Go to last step
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.goToNextStep();
        }
      });

      expect(result.current.currentStep).toBe(4); // totalSteps - 1
    });

    it('goToPreviousStep decrements current step', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.setCurrentStep(3);
      });

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.currentStep).toBe(2);
    });

    it('goToPreviousStep does not go below 0', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.currentStep).toBe(0);
    });

    it('setCurrentStep sets specific step', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.setCurrentStep(3);
      });

      expect(result.current.currentStep).toBe(3);
    });
  });

  // ============================================================
  // FORM DATA TESTS
  // ============================================================

  describe('form data management', () => {
    it('updateFormData adds new fields', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.updateFormData({ name: 'Test User' });
      });

      expect(result.current.formData.name).toBe('Test User');
    });

    it('updateFormData merges with existing data', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.updateFormData({ name: 'Test User' });
      });

      act(() => {
        result.current.updateFormData({ dietaryRestrictions: ['gluten_free'] });
      });

      expect(result.current.formData.name).toBe('Test User');
      expect(result.current.formData.dietaryRestrictions).toEqual(['gluten_free']);
    });

    it('updateFormData overwrites existing fields', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.updateFormData({ name: 'First Name' });
      });

      act(() => {
        result.current.updateFormData({ name: 'Updated Name' });
      });

      expect(result.current.formData.name).toBe('Updated Name');
    });

    it('handles dietary restrictions array', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.updateFormData({
          dietaryRestrictions: ['gluten_free', 'dairy_free'],
        });
      });

      expect(result.current.formData.dietaryRestrictions).toEqual([
        'gluten_free',
        'dairy_free',
      ]);
    });

    it('handles diet types array', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.updateFormData({
          dietTypes: ['vegetarian', 'keto'],
        });
      });

      expect(result.current.formData.dietTypes).toEqual(['vegetarian', 'keto']);
    });
  });

  // ============================================================
  // PERSISTENCE TESTS
  // ============================================================

  describe('state persistence', () => {
    it('saves state to storage on step change', async () => {
      const { Storage } = require('@/utils/storage');
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.goToNextStep();
      });

      await waitFor(() => {
        expect(Storage.setItem).toHaveBeenCalledWith(
          'onboarding_state',
          expect.any(String)
        );
      });
    });

    it('saves state to storage on form data change', async () => {
      const { Storage } = require('@/utils/storage');
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.updateFormData({ name: 'Test' });
      });

      await waitFor(() => {
        expect(Storage.setItem).toHaveBeenCalled();
      });

      const savedData = JSON.parse(
        Storage.setItem.mock.calls[Storage.setItem.mock.calls.length - 1][1]
      );
      expect(savedData.data.name).toBe('Test');
    });
  });

  // ============================================================
  // RESET TESTS
  // ============================================================

  describe('resetOnboarding', () => {
    it('resets current step to 0', async () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.setCurrentStep(3);
      });

      expect(result.current.currentStep).toBe(3);

      await act(async () => {
        await result.current.resetOnboarding();
      });

      expect(result.current.currentStep).toBe(0);
    });

    it('clears form data', async () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      act(() => {
        result.current.updateFormData({ name: 'Test User' });
      });

      expect(result.current.formData.name).toBe('Test User');

      await act(async () => {
        await result.current.resetOnboarding();
      });

      expect(result.current.formData).toEqual({});
    });

    it('removes saved state from storage', async () => {
      const { Storage } = require('@/utils/storage');
      const { result } = renderHook(() => useOnboarding(), { wrapper });

      await act(async () => {
        await result.current.resetOnboarding();
      });

      expect(Storage.removeItem).toHaveBeenCalledWith('onboarding_state');
    });
  });

  // ============================================================
  // HOOK VALIDATION TESTS
  // ============================================================

  describe('useOnboarding hook', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useOnboarding());
      }).toThrow('useOnboarding must be used within an OnboardingProvider');

      consoleSpy.mockRestore();
    });
  });
});

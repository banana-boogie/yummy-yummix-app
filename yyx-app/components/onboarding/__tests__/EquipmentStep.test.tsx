/**
 * EquipmentStep Tests
 *
 * Tests for equipment step component covering:
 * - Thermomix toggle on/off
 * - Multi-select Thermomix models (checkbox behavior)
 * - Validation: at least one model required when Thermomix selected
 * - Storage format: one KitchenEquipment entry per selected model
 * - Other equipment toggle
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EquipmentStep } from '../steps/EquipmentStep';

// Create stable references for mocks
const mockUpdateFormData = jest.fn();
const mockGoToPreviousStep = jest.fn();
const mockGoToNextStep = jest.fn();

// Test state that gets read dynamically
let mockFormData: any = { kitchenEquipment: [] };

jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    get formData() {
      return mockFormData;
    },
    updateFormData: (updates: any) => {
      mockUpdateFormData(updates);
      mockFormData = { ...mockFormData, ...updates };
    },
    goToPreviousStep: mockGoToPreviousStep,
    goToNextStep: mockGoToNextStep,
  }),
}));

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'onboarding.steps.equipment.title': 'Kitchen Equipment',
        'onboarding.steps.equipment.description': 'Select your equipment',
        'onboarding.steps.equipment.thermomix.name': 'Thermomix',
        'onboarding.steps.equipment.thermomix.modelQuestion': 'Which model(s) do you have?',
        'onboarding.steps.equipment.thermomix.modelRequired': 'Please select at least one Thermomix model',
        'onboarding.steps.equipment.air_fryer.name': 'Air Fryer',
        'onboarding.common.next': 'Next',
        'onboarding.common.back': 'Back',
      };
      return translations[key] || key;
    },
  },
}));

// Mock StepNavigationButtons
jest.mock('@/components/onboarding/StepNavigationButtons', () => ({
  StepNavigationButtons: ({ onNext, onBack }: any) => {
    const { View, Pressable, Text } = require('react-native');
    return (
      <View>
        <Pressable testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Pressable testID="next-button" onPress={onNext}>
          <Text>Next</Text>
        </Pressable>
      </View>
    );
  },
}));

// Mock equipment config
jest.mock('@/constants/equipment', () => ({
  EQUIPMENT_CONFIG: {
    thermomix: {
      id: 'thermomix',
      icon: 1, // Mock require() return value
      models: ['TM5', 'TM6', 'TM7'],
      hasModels: true,
    },
    air_fryer: {
      id: 'air_fryer',
      icon: 2,
      models: [],
      hasModels: false,
    },
  },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{name}</Text>;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFormData = { kitchenEquipment: [] };
});

describe('EquipmentStep', () => {
  it('renders title and description', () => {
    render(<EquipmentStep />);
    expect(screen.getByText('Kitchen Equipment')).toBeTruthy();
    expect(screen.getByText('Select your equipment')).toBeTruthy();
  });

  it('renders Thermomix option', () => {
    render(<EquipmentStep />);
    expect(screen.getByText('Thermomix')).toBeTruthy();
  });

  it('shows model selection when Thermomix is toggled on', () => {
    render(<EquipmentStep />);

    // Model question should not be visible initially
    expect(screen.queryByText('Which model(s) do you have?')).toBeNull();

    // Toggle Thermomix on
    fireEvent.press(screen.getByText('Thermomix'));

    // Model question and options should appear
    expect(screen.getByText('Which model(s) do you have?')).toBeTruthy();
    expect(screen.getByText('TM5')).toBeTruthy();
    expect(screen.getByText('TM6')).toBeTruthy();
    expect(screen.getByText('TM7')).toBeTruthy();
  });

  it('allows selecting multiple Thermomix models', () => {
    render(<EquipmentStep />);

    // Toggle Thermomix on
    fireEvent.press(screen.getByText('Thermomix'));

    // Select TM6
    fireEvent.press(screen.getByText('TM6'));

    // Should have one thermomix entry with TM6
    expect(mockUpdateFormData).toHaveBeenCalledWith({
      kitchenEquipment: [{ type: 'thermomix', model: 'TM6' }],
    });

    // Select TM7 as well
    fireEvent.press(screen.getByText('TM7'));

    // Should now have two thermomix entries
    const lastCall = mockUpdateFormData.mock.calls[mockUpdateFormData.mock.calls.length - 1][0];
    const thermomixEntries = lastCall.kitchenEquipment.filter(
      (e: any) => e.type === 'thermomix'
    );
    expect(thermomixEntries).toHaveLength(2);
    expect(thermomixEntries).toContainEqual({ type: 'thermomix', model: 'TM6' });
    expect(thermomixEntries).toContainEqual({ type: 'thermomix', model: 'TM7' });
  });

  it('allows deselecting a Thermomix model', () => {
    // Start with TM6 and TM7 selected
    mockFormData = {
      kitchenEquipment: [
        { type: 'thermomix', model: 'TM6' },
        { type: 'thermomix', model: 'TM7' },
      ],
    };

    render(<EquipmentStep />);

    // Deselect TM6
    fireEvent.press(screen.getByText('TM6'));

    // Should only have TM7
    const lastCall = mockUpdateFormData.mock.calls[mockUpdateFormData.mock.calls.length - 1][0];
    const thermomixEntries = lastCall.kitchenEquipment.filter(
      (e: any) => e.type === 'thermomix'
    );
    expect(thermomixEntries).toHaveLength(1);
    expect(thermomixEntries[0]).toEqual({ type: 'thermomix', model: 'TM7' });
  });

  it('validates at least one model is selected before proceeding', () => {
    render(<EquipmentStep />);

    // Toggle Thermomix on (no model selected)
    fireEvent.press(screen.getByText('Thermomix'));

    // Try to proceed
    fireEvent.press(screen.getByTestId('next-button'));

    // Should show error and not proceed
    expect(screen.getByText('Please select at least one Thermomix model')).toBeTruthy();
    expect(mockGoToNextStep).not.toHaveBeenCalled();
  });

  it('proceeds when Thermomix has at least one model selected', () => {
    mockFormData = {
      kitchenEquipment: [{ type: 'thermomix', model: 'TM6' }],
    };

    render(<EquipmentStep />);

    fireEvent.press(screen.getByTestId('next-button'));
    expect(mockGoToNextStep).toHaveBeenCalled();
  });

  it('clears models when Thermomix is toggled off', () => {
    mockFormData = {
      kitchenEquipment: [
        { type: 'thermomix', model: 'TM6' },
        { type: 'thermomix', model: 'TM7' },
      ],
    };

    render(<EquipmentStep />);

    // Toggle Thermomix off
    fireEvent.press(screen.getByText('Thermomix'));

    // Should remove all thermomix entries
    const lastCall = mockUpdateFormData.mock.calls[mockUpdateFormData.mock.calls.length - 1][0];
    expect(lastCall.kitchenEquipment).toEqual([]);
  });

  it('preserves other equipment when toggling Thermomix models', () => {
    mockFormData = {
      kitchenEquipment: [{ type: 'air_fryer' }],
    };

    render(<EquipmentStep />);

    // Toggle Thermomix on
    fireEvent.press(screen.getByText('Thermomix'));

    // Select a model
    fireEvent.press(screen.getByText('TM6'));

    // Air fryer should still be there
    const lastCall = mockUpdateFormData.mock.calls[mockUpdateFormData.mock.calls.length - 1][0];
    expect(lastCall.kitchenEquipment).toContainEqual({ type: 'air_fryer' });
    expect(lastCall.kitchenEquipment).toContainEqual({ type: 'thermomix', model: 'TM6' });
  });

  it('proceeds without Thermomix when none is selected', () => {
    mockFormData = { kitchenEquipment: [] };

    render(<EquipmentStep />);
    fireEvent.press(screen.getByTestId('next-button'));
    expect(mockGoToNextStep).toHaveBeenCalled();
  });

  it('calls goToPreviousStep when back is pressed', () => {
    render(<EquipmentStep />);
    fireEvent.press(screen.getByTestId('back-button'));
    expect(mockGoToPreviousStep).toHaveBeenCalled();
  });
});

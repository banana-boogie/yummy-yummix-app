import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { EquipmentModal } from '../EquipmentModal';
import type { KitchenEquipment } from '@/types/onboarding';

const mockOnSave = jest.fn();
const mockOnClose = jest.fn();

const defaultProps = {
  visible: true,
  onClose: mockOnClose,
  currentEquipment: [] as KitchenEquipment[],
  onSave: mockOnSave,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EquipmentModal', () => {
  it('renders the equipment options', () => {
    renderWithProviders(<EquipmentModal {...defaultProps} />);

    expect(screen.getByText('Kitchen Equipment')).toBeTruthy();
    expect(screen.getByText('Thermomix')).toBeTruthy();
    expect(screen.getByText('Air Fryer')).toBeTruthy();
  });

  it('pre-selects current equipment', () => {
    const currentEquipment: KitchenEquipment[] = [
      { type: 'thermomix', model: 'TM6' },
    ];

    renderWithProviders(
      <EquipmentModal {...defaultProps} currentEquipment={currentEquipment} />
    );

    // TM6 model button should be visible when Thermomix is selected
    expect(screen.getByText('TM6')).toBeTruthy();
    expect(screen.getByText('TM5')).toBeTruthy();
    expect(screen.getByText('TM7')).toBeTruthy();
  });

  it('shows model selection when Thermomix is toggled on', () => {
    renderWithProviders(<EquipmentModal {...defaultProps} />);

    fireEvent.press(screen.getByText('Thermomix'));

    expect(screen.getByText('Which model(s) do you have?')).toBeTruthy();
  });

  it('requires Thermomix model before saving', () => {
    renderWithProviders(<EquipmentModal {...defaultProps} />);

    // Select Thermomix without picking a model
    fireEvent.press(screen.getByText('Thermomix'));
    fireEvent.press(screen.getByText('Save'));

    // Should show error, not call onSave
    expect(screen.getByText('Please select at least one Thermomix model')).toBeTruthy();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('saves equipment selection with model', () => {
    renderWithProviders(<EquipmentModal {...defaultProps} />);

    fireEvent.press(screen.getByText('Thermomix'));
    fireEvent.press(screen.getByText('TM6'));
    fireEvent.press(screen.getByText('Save'));

    expect(mockOnSave).toHaveBeenCalledWith([
      { type: 'thermomix', model: 'TM6' },
    ]);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('saves empty equipment when nothing selected', () => {
    renderWithProviders(<EquipmentModal {...defaultProps} />);

    fireEvent.press(screen.getByText('Save'));

    expect(mockOnSave).toHaveBeenCalledWith([]);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is pressed', () => {
    renderWithProviders(<EquipmentModal {...defaultProps} />);

    // The close button uses Feather "x" icon wrapped in TouchableOpacity
    // Find the close touchable by its testID or parent structure
    const closeButtons = screen.getAllByRole('button');
    // The first button-like touchable is the close icon
    fireEvent.press(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

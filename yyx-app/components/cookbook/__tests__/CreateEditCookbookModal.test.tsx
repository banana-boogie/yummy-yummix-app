import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/utils/render';
import { CreateEditCookbookModal } from '../CreateEditCookbookModal';
import i18n from '@/i18n';

describe('CreateEditCookbookModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders in create mode with empty fields', () => {
    renderWithProviders(<CreateEditCookbookModal {...defaultProps} />);

    expect(screen.getByText(i18n.t('cookbooks.createCookbook'))).toBeTruthy();
    expect(screen.getByText(i18n.t('cookbooks.create'))).toBeTruthy();
  });

  it('renders in edit mode with pre-filled fields', () => {
    const cookbook = {
      id: 'cb-1',
      userId: 'user-1',
      name: 'My Cookbook',
      description: 'A description',
      isPublic: true,
      isDefault: false,
      shareEnabled: false,
      shareToken: 'token',
      recipeCount: 5,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    renderWithProviders(
      <CreateEditCookbookModal {...defaultProps} cookbook={cookbook} />
    );

    expect(screen.getByText(i18n.t('cookbooks.editCookbook'))).toBeTruthy();
    expect(screen.getByText(i18n.t('common.save'))).toBeTruthy();

    const nameInput = screen.getByLabelText(i18n.t('cookbooks.name'));
    expect(nameInput.props.value).toBe('My Cookbook');

    const descInput = screen.getByLabelText(i18n.t('cookbooks.description'));
    expect(descInput.props.value).toBe('A description');
  });

  it('shows validation error for name too short', () => {
    renderWithProviders(<CreateEditCookbookModal {...defaultProps} />);

    const nameInput = screen.getByLabelText(i18n.t('cookbooks.name'));
    fireEvent.changeText(nameInput, 'ab');
    fireEvent(nameInput, 'blur');

    expect(
      screen.getByText(i18n.t('cookbooks.validation.nameTooShort', { min: 3 }))
    ).toBeTruthy();
  });

  it('shows validation error for name too long', () => {
    renderWithProviders(<CreateEditCookbookModal {...defaultProps} />);

    const nameInput = screen.getByLabelText(i18n.t('cookbooks.name'));
    const longName = 'a'.repeat(51);
    fireEvent.changeText(nameInput, longName);
    fireEvent(nameInput, 'blur');

    expect(
      screen.getByText(i18n.t('cookbooks.validation.nameTooLong', { max: 50 }))
    ).toBeTruthy();
  });

  it('calls onSave with trimmed input when valid', () => {
    renderWithProviders(<CreateEditCookbookModal {...defaultProps} />);

    const nameInput = screen.getByLabelText(i18n.t('cookbooks.name'));
    fireEvent.changeText(nameInput, '  My Cookbook  ');

    const descInput = screen.getByLabelText(i18n.t('cookbooks.description'));
    fireEvent.changeText(descInput, '  A description  ');

    fireEvent.press(screen.getByText(i18n.t('cookbooks.create')));

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      nameEn: 'My Cookbook',
      descriptionEn: 'A description',
      isPublic: false,
    });
  });

  it('disables save button when loading', () => {
    renderWithProviders(
      <CreateEditCookbookModal {...defaultProps} isLoading={true} />
    );

    expect(screen.getByText(i18n.t('common.saving'))).toBeTruthy();
  });
});

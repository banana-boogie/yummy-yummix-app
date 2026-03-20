import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/utils/render';
import { CookbookSortBar } from '../CookbookSortBar';
import i18n from '@/i18n';

describe('CookbookSortBar', () => {
  it('renders all sort options', () => {
    renderWithProviders(
      <CookbookSortBar value="recent" onChange={jest.fn()} />
    );

    expect(screen.getByText(i18n.t('cookbooks.sort.recent'))).toBeTruthy();
    expect(screen.getByText(i18n.t('cookbooks.sort.mostRecipes'))).toBeTruthy();
    expect(screen.getByText(i18n.t('cookbooks.sort.alphabetical'))).toBeTruthy();
  });

  it('calls onChange when selecting a different option', () => {
    const onChange = jest.fn();

    renderWithProviders(
      <CookbookSortBar value="recent" onChange={onChange} />
    );

    fireEvent.press(screen.getByText(i18n.t('cookbooks.sort.mostRecipes')));

    expect(onChange).toHaveBeenCalledWith('mostRecipes');
  });
});

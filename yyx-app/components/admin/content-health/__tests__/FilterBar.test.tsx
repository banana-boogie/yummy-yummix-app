import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { FilterBar } from '../FilterBar';

describe('FilterBar', () => {
  it('renders all issue and entity filter chips', () => {
    renderWithProviders(
      <FilterBar
        activeFilter="all"
        entityFilter="all"
        onActiveFilterChange={jest.fn()}
        onEntityFilterChange={jest.fn()}
      />
    );

    // Issue chips
    // "All" appears twice (once for issue, once for entity), just check it exists
    expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Translation')).toBeTruthy();
    expect(screen.getByText('Image')).toBeTruthy();
    expect(screen.getByText('Nutrition')).toBeTruthy();
    expect(screen.getByText('Unpublished')).toBeTruthy();

    // Entity chips
    expect(screen.getByText('Recipes')).toBeTruthy();
    expect(screen.getByText('Ingredients')).toBeTruthy();
    expect(screen.getByText('Kitchen Tools')).toBeTruthy();
  });

  it('calls onActiveFilterChange when issue chip is pressed', () => {
    const onActiveFilterChange = jest.fn();
    renderWithProviders(
      <FilterBar
        activeFilter="all"
        entityFilter="all"
        onActiveFilterChange={onActiveFilterChange}
        onEntityFilterChange={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText('Translation'));
    expect(onActiveFilterChange).toHaveBeenCalledWith('translation');
  });

  it('calls onEntityFilterChange when entity chip is pressed', () => {
    const onEntityFilterChange = jest.fn();
    renderWithProviders(
      <FilterBar
        activeFilter="all"
        entityFilter="all"
        onActiveFilterChange={jest.fn()}
        onEntityFilterChange={onEntityFilterChange}
      />
    );

    fireEvent.press(screen.getByText('Recipes'));
    expect(onEntityFilterChange).toHaveBeenCalledWith('recipe');
  });
});

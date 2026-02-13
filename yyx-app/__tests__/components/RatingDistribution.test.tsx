import React from 'react';
import { renderWithProviders, screen } from '@/test/utils/render';
import { RatingDistribution } from '@/components/rating/RatingDistribution';

jest.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'recipes.rating.ratingCount': `${params?.count ?? ''} rating`,
      'recipes.rating.ratingsCount': `${params?.count ?? ''} ratings`,
    };
    return translations[key] || key;
  },
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

describe('RatingDistribution', () => {
  const defaultDistribution = { 1: 2, 2: 3, 3: 5, 4: 8, 5: 12 };
  const defaultTotal = 30;
  const defaultAverage = 3.8;

  it('returns null when total is 0', () => {
    const { toJSON } = renderWithProviders(
      <RatingDistribution
        distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }}
        total={0}
        averageRating={null}
      />
    );

    expect(toJSON()).toBeNull();
  });

  it('renders distribution bars for each star level', () => {
    renderWithProviders(
      <RatingDistribution
        distribution={defaultDistribution}
        total={defaultTotal}
        averageRating={defaultAverage}
      />
    );

    // All 5 star-level labels should be present
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('displays average rating and total count', () => {
    renderWithProviders(
      <RatingDistribution
        distribution={defaultDistribution}
        total={defaultTotal}
        averageRating={defaultAverage}
      />
    );

    expect(screen.getByText('3.8')).toBeTruthy();
    expect(screen.getByText('30 ratings')).toBeTruthy();
  });

  it('displays correct percentage labels', () => {
    renderWithProviders(
      <RatingDistribution
        distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 10 }}
        total={10}
        averageRating={5.0}
      />
    );

    // 5-star row should show 100%
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('displays singular rating count for total of 1', () => {
    renderWithProviders(
      <RatingDistribution
        distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }}
        total={1}
        averageRating={5.0}
      />
    );

    expect(screen.getByText('1 rating')).toBeTruthy();
  });

  it('displays dash when averageRating is null', () => {
    renderWithProviders(
      <RatingDistribution
        distribution={{ 1: 1, 2: 0, 3: 0, 4: 0, 5: 0 }}
        total={1}
        averageRating={null}
      />
    );

    expect(screen.getByText('—')).toBeTruthy();
  });
});

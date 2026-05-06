import { toDisplayName, mapIngredient } from '../mapSupabaseItem';

describe('toDisplayName', () => {
    it('capitalizes a lowercase first character', () => {
        expect(toDisplayName('olive oil')).toBe('Olive oil');
        expect(toDisplayName('apple')).toBe('Apple');
    });

    it('leaves already-capitalized strings untouched', () => {
        expect(toDisplayName('Olive oil')).toBe('Olive oil');
        expect(toDisplayName('Granny Smith apple')).toBe('Granny Smith apple');
    });

    it('does not lowercase the rest of the word — proper nouns survive', () => {
        // Even if the first char was lowercase, we only touch the first.
        expect(toDisplayName('granny Smith apple')).toBe('Granny Smith apple');
    });

    it('returns empty string for nullish input', () => {
        expect(toDisplayName(null)).toBe('');
        expect(toDisplayName(undefined)).toBe('');
        expect(toDisplayName('')).toBe('');
    });

    it('handles single-char strings', () => {
        expect(toDisplayName('a')).toBe('A');
        expect(toDisplayName('A')).toBe('A');
    });
});

describe('mapIngredient — display normalization', () => {
    it('normalizes a lowercase canonical translation to sentence case', () => {
        const result = mapIngredient(
            {
                id: 'ing-1',
                image_url: 'http://example.com/x.png',
                translations: [{ locale: 'en', name: 'olive oil' }],
            },
            'en',
        );
        expect(result.name).toBe('Olive oil');
    });

    it('normalizes a lowercase nameCustom override', () => {
        const result = mapIngredient(
            {
                id: 'ing-1',
                translations: [{ locale: 'en', name: 'apple' }],
            },
            'en',
            'granny smith apple',
        );
        expect(result.name).toBe('Granny smith apple');
    });

    it('preserves proper nouns in canonical translations', () => {
        const result = mapIngredient(
            {
                id: 'ing-1',
                translations: [{ locale: 'en', name: 'Granny Smith apple' }],
            },
            'en',
        );
        expect(result.name).toBe('Granny Smith apple');
    });

    it('normalizes plural names too', () => {
        const result = mapIngredient(
            {
                id: 'ing-1',
                translations: [{ locale: 'en', name: 'apple', plural_name: 'apples' }],
            },
            'en',
        );
        expect(result.name).toBe('Apple');
        expect(result.pluralName).toBe('Apples');
    });
});

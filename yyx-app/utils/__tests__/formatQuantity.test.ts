import { formatQuantity } from '../formatQuantity';

describe('formatQuantity', () => {
    it('renders whole numbers without a fraction', () => {
        expect(formatQuantity(1)).toBe('1');
        expect(formatQuantity(2)).toBe('2');
        expect(formatQuantity(0)).toBe('0');
        expect(formatQuantity(10)).toBe('10');
    });

    it('snaps near-integer values to whole numbers', () => {
        expect(formatQuantity(1.02)).toBe('1');
        expect(formatQuantity(0.97)).toBe('1');
        expect(formatQuantity(2.04)).toBe('2');
    });

    it('snaps to 1/2', () => {
        expect(formatQuantity(0.5)).toBe('1/2');
        expect(formatQuantity(1.5)).toBe('1 1/2');
        expect(formatQuantity(2.51)).toBe('2 1/2');
        expect(formatQuantity(2.48)).toBe('2 1/2');
    });

    it('snaps to 1/3 and 2/3', () => {
        expect(formatQuantity(0.3)).toBe('1/3');
        expect(formatQuantity(0.33)).toBe('1/3');
        expect(formatQuantity(0.34)).toBe('1/3');
        expect(formatQuantity(0.66)).toBe('2/3');
        expect(formatQuantity(0.7)).toBe('2/3');
        expect(formatQuantity(2.333)).toBe('2 1/3');
    });

    it('snaps to 1/4 and 3/4', () => {
        expect(formatQuantity(0.25)).toBe('1/4');
        expect(formatQuantity(0.75)).toBe('3/4');
        expect(formatQuantity(1.25)).toBe('1 1/4');
        expect(formatQuantity(3.75)).toBe('3 3/4');
    });

    it('snaps to 1/8 and 7/8', () => {
        expect(formatQuantity(0.125)).toBe('1/8');
        expect(formatQuantity(0.875)).toBe('7/8');
        expect(formatQuantity(2.875)).toBe('2 7/8');
    });

    it('falls back to compact decimal when no fraction matches', () => {
        // 0.4 sits between 1/3 (0.333) and 1/2 (0.5); both are >0.05 away.
        expect(formatQuantity(0.4)).toBe('0.4');
        // 0.6 sits between 1/2 and 2/3; both are >0.05 away.
        expect(formatQuantity(0.6)).toBe('0.6');
        // 1.42 → whole 1 + 0.42 (no match) → "1.42"
        expect(formatQuantity(1.42)).toBe('1.42');
    });

    it('strips trailing zeros from decimal fallback', () => {
        // toFixed(2) would produce "1.40" — we want "1.4"
        expect(formatQuantity(1.4)).toBe('1.4');
    });

    it('handles negative quantities', () => {
        expect(formatQuantity(-0.5)).toBe('-1/2');
        expect(formatQuantity(-2)).toBe('-2');
    });

    it('handles non-finite values gracefully', () => {
        expect(formatQuantity(NaN)).toBe('');
        expect(formatQuantity(Infinity)).toBe('');
    });

    it('respects a custom tolerance', () => {
        // 0.4 at tolerance 0.1 falls to 1/3 (closer) — within tolerance now.
        expect(formatQuantity(0.4, { tolerance: 0.1 })).toBe('1/3');
        // 0.4 at default tolerance 0.05 falls to decimal.
        expect(formatQuantity(0.4)).toBe('0.4');
    });
});

import {
    convertQuantity,
    isConvertible,
    consolidationKey,
    type ConvertibleUnit,
} from '../unitConversion';

const g: ConvertibleUnit = { id: 'g', type: 'weight', baseFactor: 1 };
const kg: ConvertibleUnit = { id: 'kg', type: 'weight', baseFactor: 1000 };
const oz: ConvertibleUnit = { id: 'oz', type: 'weight', baseFactor: 28.349523125 };
const lb: ConvertibleUnit = { id: 'lb', type: 'weight', baseFactor: 453.59237 };
const ml: ConvertibleUnit = { id: 'ml', type: 'volume', baseFactor: 1 };
const l: ConvertibleUnit = { id: 'l', type: 'volume', baseFactor: 1000 };
const cup: ConvertibleUnit = { id: 'cup', type: 'volume', baseFactor: 236.5882365 };
const tbsp: ConvertibleUnit = { id: 'tbsp', type: 'volume', baseFactor: 14.78676478125 };
const tsp: ConvertibleUnit = { id: 'tsp', type: 'volume', baseFactor: 4.92892159375 };
const piece: ConvertibleUnit = { id: 'piece', type: 'unit' }; // no baseFactor

describe('isConvertible', () => {
    it('is true for units with finite base factors', () => {
        expect(isConvertible(g)).toBe(true);
        expect(isConvertible(cup)).toBe(true);
    });

    it('is false for discrete units without base factor', () => {
        expect(isConvertible(piece)).toBe(false);
        expect(isConvertible(undefined)).toBe(false);
        expect(isConvertible(null)).toBe(false);
    });
});

describe('convertQuantity — within mass dimension', () => {
    it('kg → g multiplies by 1000', () => {
        expect(convertQuantity(1, kg, g)).toBe(1000);
        expect(convertQuantity(2.5, kg, g)).toBe(2500);
    });

    it('g → kg divides by 1000', () => {
        expect(convertQuantity(1500, g, kg)).toBe(1.5);
    });

    it('oz → g uses NIST factor', () => {
        // 1 oz = 28.349523125 g
        expect(convertQuantity(1, oz, g)).toBeCloseTo(28.349523125, 6);
        expect(convertQuantity(16, oz, g)).toBeCloseTo(453.59237, 6); // = 1 lb
    });

    it('lb → kg cross-system', () => {
        // 1 lb = 0.45359237 kg
        expect(convertQuantity(1, lb, kg)).toBeCloseTo(0.45359237, 6);
    });
});

describe('convertQuantity — within volume dimension', () => {
    it('cup → ml uses NIST factor', () => {
        expect(convertQuantity(1, cup, ml)).toBeCloseTo(236.5882365, 4);
    });

    it('tbsp = 3 tsp', () => {
        // 1 tbsp / tsp factor should be 3
        expect(convertQuantity(1, tbsp, tsp)).toBeCloseTo(3, 6);
    });

    it('cup = 16 tbsp', () => {
        expect(convertQuantity(1, cup, tbsp)).toBeCloseTo(16, 4);
    });

    it('L → ml multiplies by 1000', () => {
        expect(convertQuantity(2, l, ml)).toBe(2000);
    });
});

describe('convertQuantity — refuses cross-dimension', () => {
    it('returns null when dimensions differ', () => {
        expect(convertQuantity(100, g, ml)).toBeNull();
        expect(convertQuantity(1, cup, kg)).toBeNull();
    });

    it('returns null when either unit lacks a base factor', () => {
        expect(convertQuantity(1, piece, g)).toBeNull();
        expect(convertQuantity(1, g, piece)).toBeNull();
    });

    it('returns null for nullish units', () => {
        expect(convertQuantity(1, null, g)).toBeNull();
        expect(convertQuantity(1, g, undefined)).toBeNull();
    });
});

describe('consolidationKey', () => {
    it('keys convertible units by ingredient + dimension', () => {
        // g and kg (both weight) collapse into the same key
        expect(consolidationKey('flour-uuid', g)).toBe(consolidationKey('flour-uuid', kg));
        expect(consolidationKey('flour-uuid', g)).toBe('flour-uuid:dim:weight');
    });

    it('keys volume separately from weight', () => {
        expect(consolidationKey('oil-uuid', g)).not.toBe(consolidationKey('oil-uuid', ml));
    });

    it('keys discrete units by ingredient + unit_id', () => {
        // piece doesn't have baseFactor → falls back to unit-id keying
        expect(consolidationKey('egg-uuid', piece)).toBe('egg-uuid:unit:piece');
    });

    it('different ingredients always have different keys', () => {
        expect(consolidationKey('flour', g)).not.toBe(consolidationKey('sugar', g));
    });

    it('keys missing-unit canonical rows separately from discrete units', () => {
        expect(consolidationKey('ingredient-uuid', undefined)).toBe('ingredient-uuid:unit:null');
        expect(consolidationKey('ingredient-uuid', piece)).toBe('ingredient-uuid:unit:piece');
    });
});

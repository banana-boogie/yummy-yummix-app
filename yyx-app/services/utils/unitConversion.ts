/**
 * Unit-conversion helpers for shopping-list consolidation.
 *
 * The shopping-list service consolidates the same canonical ingredient
 * across recipes when units share a dimension (g+kg → 1 row, ml+L → 1 row).
 * Incompatible dimensions (115g + 5ml) intentionally stay separate.
 *
 * Conversion factors live in `measurement_units.base_factor` (added in
 * 20260505190000_add_measurement_unit_base_factor.sql). Units without a
 * base factor (clove, piece, pinch, etc.) are treated as discrete and
 * fall back to per-unit-id keying — same as pre-PR behavior.
 */
import type { MeasurementUnit } from '@/types/recipe.types';

/** A minimal unit shape for conversion math. */
export interface ConvertibleUnit {
    id: string;
    type: MeasurementUnit['type'];
    baseFactor?: number;
}

/** True if this unit can participate in cross-unit dimension math. */
export function isConvertible(
    unit: ConvertibleUnit | undefined | null,
): unit is ConvertibleUnit & { baseFactor: number } {
    return !!unit && typeof unit.baseFactor === 'number' && Number.isFinite(unit.baseFactor);
}

/**
 * Converts a quantity from `fromUnit` to `toUnit` when both share a
 * dimension and have base factors. Returns null otherwise — caller should
 * keep the rows separate.
 */
export function convertQuantity(
    quantity: number,
    fromUnit: ConvertibleUnit | undefined | null,
    toUnit: ConvertibleUnit | undefined | null,
): number | null {
    if (!isConvertible(fromUnit) || !isConvertible(toUnit)) return null;
    if (fromUnit.type !== toUnit.type) return null;
    if (toUnit.baseFactor === 0) return null;
    return (quantity * fromUnit.baseFactor) / toUnit.baseFactor;
}

/**
 * Builds the consolidation key for a canonical ingredient row.
 * - Convertible units key by `(ingredient_id, dimension)` so all g/kg/oz/lb
 *   of the same ingredient collapse into one row.
 * - Discrete units (no base factor) key by `(ingredient_id, unit_id)`,
 *   matching pre-PR behavior — same unit merges, different units stay split.
 * - Free-text rows should not call this helper; callers should insert them
 *   as independent rows because there is no canonical ingredient identity.
 */
export function consolidationKey(
    ingredientId: string,
    unit: ConvertibleUnit | undefined | null,
): string {
    if (isConvertible(unit)) return `${ingredientId}:dim:${unit.type}`;
    const unitId = unit?.id ?? 'null';
    return `${ingredientId}:unit:${unitId}`;
}

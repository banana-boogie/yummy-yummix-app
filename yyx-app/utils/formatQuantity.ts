/**
 * Renders a numeric quantity as a human-friendly string, snapping decimals
 * to common cooking fractions (1/8, 1/4, 1/3, 1/2, 2/3, 3/4, 7/8) when the
 * decimal lands within tolerance. Whole numbers stay whole; mixed numbers
 * render as "2 1/2"; off-grid decimals fall back to compact decimal form.
 *
 * Lupita doesn't read "0.3 cdta" — she reads "1/3 cdta". This bridges the
 * gap between numeric DB storage and recipe-card UX.
 */

interface CommonFraction {
    /** Decimal value (e.g. 1/3 → 0.3333…) */
    value: number;
    /** Display string (e.g. "1/3") */
    display: string;
}

// Ordered ascending. The snap loop picks the first within tolerance.
const COMMON_FRACTIONS: readonly CommonFraction[] = [
    { value: 1 / 8, display: '1/8' },
    { value: 1 / 4, display: '1/4' },
    { value: 1 / 3, display: '1/3' },
    { value: 1 / 2, display: '1/2' },
    { value: 2 / 3, display: '2/3' },
    { value: 3 / 4, display: '3/4' },
    { value: 7 / 8, display: '7/8' },
] as const;

const DEFAULT_TOLERANCE = 0.05;

interface FormatOpts {
    /** How close a decimal must be to a common fraction to snap. */
    tolerance?: number;
}

export function formatQuantity(qty: number, opts: FormatOpts = {}): string {
    if (!Number.isFinite(qty)) return '';
    if (qty < 0) return formatQuantity(Math.abs(qty), opts).replace(/^/, '-');

    const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;
    const whole = Math.floor(qty);
    const fraction = qty - whole;

    // Whole number — no fraction part. For values below 1, avoid displaying
    // a real positive quantity as "0" just because it is inside tolerance.
    if (fraction < tolerance && whole > 0) {
        return String(whole);
    }

    // Snap fraction to nearest common fraction within tolerance.
    let bestMatch: CommonFraction | undefined;
    let bestDelta = tolerance;
    for (const cf of COMMON_FRACTIONS) {
        const delta = Math.abs(fraction - cf.value);
        if (delta <= bestDelta) {
            bestDelta = delta;
            bestMatch = cf;
        }
    }

    if (bestMatch) {
        return whole === 0 ? bestMatch.display : `${whole} ${bestMatch.display}`;
    }

    // Special case: fraction so close to 1 it should round up.
    if (1 - fraction <= tolerance) {
        return String(whole + 1);
    }

    // No common fraction matches — render as compact decimal.
    // toFixed(2) → strip trailing zeros and trailing dot.
    return qty.toFixed(2).replace(/\.?0+$/, '');
}

export default formatQuantity;

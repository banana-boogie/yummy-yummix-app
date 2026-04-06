/**
 * Thermomix parameter validation and sanitization for recipe steps.
 */

import { VALID_THERMOMIX_MODES } from "../../equipment-utils.ts";

// ============================================================
// Validation Constants
// ============================================================

/** Valid Thermomix numeric speeds. Exported for testing. */
export const VALID_NUMERIC_SPEEDS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
] as const;

/** Valid Thermomix special speeds (lowercase for comparison). Exported for testing. */
export const VALID_SPECIAL_SPEEDS = ["spoon", "reverse"] as const;

/** Valid Thermomix special temperatures. Exported for testing. */
export const VALID_SPECIAL_TEMPS = ["Varoma"] as const;

/** Regex for validating temperature strings (e.g., "100°C", "212°F"). Exported for testing. */
export const TEMP_REGEX = /^\d+(\.\d+)?°[CF]$/;

// ============================================================
// Speed Parsing
// ============================================================

/**
 * Parse a Thermomix speed string into a normalized form.
 * Accepts: "1"-"10", "Spoon", "Reverse", "Reverse 1"-"Reverse 10", "Reverse Spoon"
 * Returns: normalized string or null if invalid.
 * Exported for testing.
 */
export function parseThermomixSpeed(raw: string): string | null {
  const lower = raw.toLowerCase().trim();

  // Pure numeric: "1" through "10"
  if (VALID_NUMERIC_SPEEDS.includes(lower as any)) return lower;

  // Standalone special: "spoon", "reverse"
  if (lower === "spoon") return "Spoon";
  if (lower === "reverse") return "Reverse";

  // Composite: "reverse spoon" — spoon attachment in reverse
  if (lower === "reverse spoon" || lower === "spoon reverse") {
    return "Reverse Spoon";
  }

  // Composite: "reverse 1", "Reverse 5", etc.
  const reverseNumeric = lower.match(/^reverse\s+(\d+)$/);
  if (reverseNumeric) {
    const num = reverseNumeric[1];
    if (VALID_NUMERIC_SPEEDS.includes(num as any)) return `Reverse ${num}`;
    return null;
  }

  // Reversed order: "1 reverse", "5 reverse"
  const numericReverse = lower.match(/^(\d+)\s+reverse$/);
  if (numericReverse) {
    const num = numericReverse[1];
    if (VALID_NUMERIC_SPEEDS.includes(num as any)) return `Reverse ${num}`;
    return null;
  }

  return null;
}

// ============================================================
// Step Validation
// ============================================================

/**
 * Validate and sanitize Thermomix parameters in recipe steps.
 * Ensures speeds, temperatures, and times are within valid ranges.
 * Exported for testing.
 */
export function validateThermomixSteps(
  steps: Array<{
    order: number;
    instruction: string;
    thermomixTime?: number | null;
    thermomixTemp?: string | null;
    thermomixSpeed?: string | null;
    thermomixMode?: string | null;
    tip?: string | null;
  }>,
): Array<{
  order: number;
  instruction: string;
  thermomixTime?: number | null;
  thermomixTemp?: string | null;
  thermomixSpeed?: string | null;
  thermomixMode?: string | null;
  tip?: string | null;
}> {
  return steps.map((step) => {
    // Skip if no Thermomix params (check for both null and undefined)
    if (
      step.thermomixTime == null &&
      step.thermomixTemp == null &&
      step.thermomixSpeed == null &&
      step.thermomixMode == null
    ) {
      return step;
    }

    const validated = { ...step };

    // Validate time (must be positive number, not NaN or null)
    if (step.thermomixTime != null) {
      if (
        typeof step.thermomixTime !== "number" ||
        Number.isNaN(step.thermomixTime) || step.thermomixTime <= 0
      ) {
        console.warn(
          `Invalid Thermomix time for step ${step.order}: ${step.thermomixTime}. Removing.`,
        );
        validated.thermomixTime = undefined;
      }
    }

    // Validate speed (supports composite like "Reverse 1", "Spoon", "5")
    if (step.thermomixSpeed != null) {
      const parsed = parseThermomixSpeed(step.thermomixSpeed);
      if (!parsed) {
        console.warn(
          `Invalid Thermomix speed for step ${step.order}: ${step.thermomixSpeed}. Removing.`,
        );
        validated.thermomixSpeed = undefined;
      } else {
        validated.thermomixSpeed = parsed;
      }
    }

    // Validate temperature
    if (step.thermomixTemp != null) {
      const isValid = TEMP_REGEX.test(step.thermomixTemp) ||
        VALID_SPECIAL_TEMPS.includes(step.thermomixTemp as any);
      if (!isValid) {
        console.warn(
          `Invalid Thermomix temperature for step ${step.order}: ${step.thermomixTemp}. Removing.`,
        );
        validated.thermomixTemp = undefined;
      }
    }

    // Validate cooking mode (must be a known mode string)
    if (step.thermomixMode != null) {
      if (
        !(VALID_THERMOMIX_MODES as readonly string[]).includes(
          step.thermomixMode,
        )
      ) {
        console.warn(
          `Invalid Thermomix mode for step ${step.order}: ${step.thermomixMode}. Removing.`,
        );
        validated.thermomixMode = undefined;
      }
    }

    // High temperature (browning) mode has NO speed — force null
    if (validated.thermomixMode === "browning") {
      if (validated.thermomixSpeed != null) {
        console.warn(
          `Step ${step.order}: browning mode has no speed setting. Forcing speed to null.`,
        );
        validated.thermomixSpeed = undefined;
      }
    }

    // Pair completion: time + speed must appear together (skip for browning which has no speed)
    const hasTime = validated.thermomixTime != null;
    const hasSpeed = validated.thermomixSpeed != null;
    if (validated.thermomixMode === "browning") {
      // browning only needs time, no speed
    } else if (hasTime && !hasSpeed) {
      console.warn(
        `Step ${step.order}: thermomixTime set without thermomixSpeed. Filling speed with "1" (gentle default).`,
      );
      validated.thermomixSpeed = "1";
    } else if (hasSpeed && !hasTime) {
      console.warn(
        `Step ${step.order}: thermomixSpeed set without thermomixTime. Filling time with 60 (safe default).`,
      );
      validated.thermomixTime = 60;
    }

    return validated;
  });
}

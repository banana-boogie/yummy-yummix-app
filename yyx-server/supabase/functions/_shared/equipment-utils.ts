/**
 * Equipment Utilities
 *
 * Shared helpers for kitchen equipment detection.
 */

/** Supported Thermomix model identifiers. */
export type ThermomixModel = "TM5" | "TM6" | "TM7";

/**
 * Check if the user's kitchen equipment includes a Thermomix.
 */
export function hasThermomix(kitchenEquipment: string[]): boolean {
  return kitchenEquipment.some((eq) => eq.toLowerCase().includes("thermomix"));
}

/**
 * Extract the Thermomix model from a kitchen_equipment array.
 *
 * Parses entries like "thermomix_TM6", "thermomix_tm7", "Thermomix TM5".
 * Returns the model ("TM5" | "TM6" | "TM7") or null if no match is found.
 */
export function getThermomixModel(
  kitchenEquipment: string[],
): ThermomixModel | null {
  for (const eq of kitchenEquipment) {
    const upper = eq.toUpperCase();
    if (upper.includes("TM7")) return "TM7";
    if (upper.includes("TM6")) return "TM6";
    if (upper.includes("TM5")) return "TM5";
  }
  return null;
}

/**
 * Check if the user's kitchen equipment includes an Air Fryer.
 */
export function hasAirFryer(kitchenEquipment: string[]): boolean {
  return kitchenEquipment.some((eq) => {
    const lower = eq.toLowerCase();
    return lower.includes("air fryer") || lower.includes("air_fryer") ||
      lower.includes("airfryer") || lower.includes("freidora de aire");
  });
}

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

/** Model ranking used for sorting (highest = newest). */
const MODEL_RANK: Record<ThermomixModel, number> = {
  TM5: 1,
  TM6: 2,
  TM7: 3,
};

/**
 * Extract ALL Thermomix models from a kitchen_equipment array.
 *
 * Parses entries like "thermomix_TM6", "thermomix_tm7", "Thermomix TM5".
 * Returns an array of unique models sorted newest-first (e.g. ["TM7", "TM6"]).
 * Returns an empty array if no models are found.
 */
export function getThermomixModels(
  kitchenEquipment: string[],
): ThermomixModel[] {
  const found = new Set<ThermomixModel>();
  for (const eq of kitchenEquipment) {
    const upper = eq.toUpperCase();
    if (upper.includes("TM7")) found.add("TM7");
    if (upper.includes("TM6")) found.add("TM6");
    if (upper.includes("TM5")) found.add("TM5");
  }
  return [...found].sort((a, b) => MODEL_RANK[b] - MODEL_RANK[a]);
}

/**
 * Extract the Thermomix model from a kitchen_equipment array.
 *
 * Returns the newest (highest-ranked) model, or null if none found.
 * For multi-model support, use `getThermomixModels()` instead.
 */
export function getThermomixModel(
  kitchenEquipment: string[],
): ThermomixModel | null {
  const models = getThermomixModels(kitchenEquipment);
  return models.length > 0 ? models[0] : null;
}

/** Valid Thermomix cooking mode identifiers. Single source of truth. */
export const VALID_THERMOMIX_MODES = [
  "slow_cook",
  "rice_cooker",
  "sous_vide",
  "fermentation",
  "open_cooking",
  "high_temperature",
  "dough",
  "turbo",
] as const;

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

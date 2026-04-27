import type { CanonicalMealType } from "./types.ts";

const LOCALE_TO_CANONICAL: Record<string, CanonicalMealType> = {
  breakfast: "breakfast",
  comida: "lunch",
  desayuno: "breakfast",
  dinner: "dinner",
  dessert: "dessert",
  lunch: "lunch",
  cena: "dinner",
  snack: "snack",
  botana: "snack",
  postre: "dessert",
  beverage: "beverage",
  bebida: "beverage",
};

export function toCanonicalMealType(input: string): CanonicalMealType {
  const canonical = LOCALE_TO_CANONICAL[input.trim().toLowerCase()];
  if (!canonical) {
    throw new Error(`Unknown meal type: ${input}`);
  }
  return canonical;
}

export function normalizeMealTypes(inputs: string[]): CanonicalMealType[] {
  return inputs.map(toCanonicalMealType);
}

// Locale-specific display labels for canonical meal types. Only includes
// languages whose label differs from the canonical English token.
const LOCALE_LABELS: Record<
  string,
  Partial<Record<CanonicalMealType, string>>
> = {
  es: {
    breakfast: "desayuno",
    lunch: "comida",
    dinner: "cena",
    snack: "snack",
    dessert: "postre",
    beverage: "bebida",
  },
};

function getBaseLanguage(locale: string): string {
  return locale.split("-")[0];
}

/**
 * Locale-aware display label for a canonical meal type. Returns the English
 * canonical token when the locale has no override (e.g. `en-US` → "dinner").
 */
export function localeLabelFor(
  mealType: CanonicalMealType,
  locale: string,
): string {
  return LOCALE_LABELS[getBaseLanguage(locale)]?.[mealType] ?? mealType;
}

/**
 * Resolve a user-typed meal label (e.g. "comida") to the locale's display
 * label, going through the canonical type. Used by `classifySlots` when the
 * caller passed a localized input string and we want to echo it back as the
 * display label.
 */
export function resolveDisplayMealLabel(
  rawInput: string,
  canonical: CanonicalMealType,
  locale: string,
): string {
  const trimmed = rawInput.trim().toLowerCase();
  const table = LOCALE_LABELS[getBaseLanguage(locale)];
  if (trimmed === table?.[canonical]) return trimmed;
  return table?.[canonical] ?? canonical;
}

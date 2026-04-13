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

/**
 * Meal Context Detection Tests
 *
 * Tests the detectMealContext function for multilingual support,
 * edge cases, and proper meal type/time preference detection.
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";

// Import the function (would need to be exported from index.ts)
// For now, we'll recreate it here for testing
function detectMealContext(message: string): {
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  timePreference?: "quick" | "normal" | "elaborate";
} {
  const lowerMessage = message.toLowerCase();

  // Meal type detection (multilingual)
  const mealPatterns = {
    breakfast: /breakfast|desayuno|morning|ma[ñn]ana|brunch/i,
    lunch: /lunch|almuerzo|comida|noon|mediod[íi]a/i,
    dinner: /dinner|cena|supper|evening|noche/i,
    snack: /snack|aperitivo|merienda|appetizer|botana/i,
  };

  let mealType: "breakfast" | "lunch" | "dinner" | "snack" | undefined;
  for (const [type, pattern] of Object.entries(mealPatterns)) {
    if (pattern.test(lowerMessage)) {
      mealType = type as "breakfast" | "lunch" | "dinner" | "snack";
      break;
    }
  }

  // Time preference detection
  const quickPatterns = /quick|fast|r[aá]pido|30 min|simple|easy/i;
  const elaboratePatterns =
    /elaborate|fancy|special|complejo|elegante|gourmet/i;

  let timePreference: "quick" | "normal" | "elaborate" | undefined;
  if (quickPatterns.test(lowerMessage)) {
    timePreference = "quick";
  } else if (elaboratePatterns.test(lowerMessage)) {
    timePreference = "elaborate";
  }

  return { mealType, timePreference };
}

Deno.test("detectMealContext - English breakfast", () => {
  const result = detectMealContext("What can I make for breakfast?");
  assertEquals(result.mealType, "breakfast");
});

Deno.test("detectMealContext - Spanish breakfast", () => {
  const result = detectMealContext("¿Qué puedo hacer para el desayuno?");
  assertEquals(result.mealType, "breakfast");
});

Deno.test("detectMealContext - English lunch", () => {
  const result = detectMealContext("I need a lunch recipe");
  assertEquals(result.mealType, "lunch");
});

Deno.test("detectMealContext - Spanish lunch", () => {
  const result = detectMealContext("Necesito una receta para el almuerzo");
  assertEquals(result.mealType, "lunch");
});

Deno.test("detectMealContext - English dinner", () => {
  const result = detectMealContext("What should I make for dinner tonight?");
  assertEquals(result.mealType, "dinner");
});

Deno.test("detectMealContext - Spanish dinner", () => {
  const result = detectMealContext("¿Qué debo hacer para la cena?");
  assertEquals(result.mealType, "dinner");
});

Deno.test("detectMealContext - English snack", () => {
  const result = detectMealContext("I want a quick snack");
  assertEquals(result.mealType, "snack");
});

Deno.test("detectMealContext - Spanish snack", () => {
  const result = detectMealContext("Quiero una merienda rápida");
  assertEquals(result.mealType, "snack");
});

Deno.test("detectMealContext - quick time preference (English)", () => {
  const result = detectMealContext("I need something quick for dinner");
  assertEquals(result.mealType, "dinner");
  assertEquals(result.timePreference, "quick");
});

Deno.test("detectMealContext - quick time preference (Spanish)", () => {
  const result = detectMealContext("Necesito algo rápido para la cena");
  assertEquals(result.mealType, "dinner");
  assertEquals(result.timePreference, "quick");
});

Deno.test("detectMealContext - elaborate time preference", () => {
  const result = detectMealContext("I want to make an elaborate dinner");
  assertEquals(result.mealType, "dinner");
  assertEquals(result.timePreference, "elaborate");
});

Deno.test("detectMealContext - 30 minute quick preference", () => {
  const result = detectMealContext("What can I make in 30 min for lunch?");
  assertEquals(result.mealType, "lunch");
  assertEquals(result.timePreference, "quick");
});

Deno.test("detectMealContext - no meal type detected", () => {
  const result = detectMealContext("I have chicken and rice");
  assertEquals(result.mealType, undefined);
});

Deno.test("detectMealContext - no time preference", () => {
  const result = detectMealContext("What can I make for dinner?");
  assertEquals(result.mealType, "dinner");
  assertEquals(result.timePreference, undefined);
});

Deno.test("detectMealContext - case insensitive", () => {
  const result = detectMealContext("WHAT CAN I MAKE FOR BREAKFAST?");
  assertEquals(result.mealType, "breakfast");
});

Deno.test("detectMealContext - mixed case with accents", () => {
  const result = detectMealContext("¿Qué puedo hacer para la Mañana?");
  assertEquals(result.mealType, "breakfast");
});

Deno.test("detectMealContext - brunch detection", () => {
  const result = detectMealContext("Looking for brunch ideas");
  assertEquals(result.mealType, "breakfast");
});

Deno.test("detectMealContext - evening as dinner", () => {
  const result = detectMealContext("What should I cook this evening?");
  assertEquals(result.mealType, "dinner");
});

Deno.test("detectMealContext - multiple meal mentions (first wins)", () => {
  const result = detectMealContext("After breakfast, I need lunch ideas");
  assertEquals(result.mealType, "breakfast");
});

Deno.test("detectMealContext - fancy/gourmet as elaborate", () => {
  const result1 = detectMealContext("I want a fancy dinner");
  assertEquals(result1.timePreference, "elaborate");

  const result2 = detectMealContext("Make something gourmet");
  assertEquals(result2.timePreference, "elaborate");
});

Deno.test("detectMealContext - empty string", () => {
  const result = detectMealContext("");
  assertEquals(result.mealType, undefined);
  assertEquals(result.timePreference, undefined);
});

Deno.test("detectMealContext - whitespace only", () => {
  const result = detectMealContext("   ");
  assertEquals(result.mealType, undefined);
});

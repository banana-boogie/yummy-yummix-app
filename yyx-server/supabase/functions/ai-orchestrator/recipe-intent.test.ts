/**
 * Recipe Intent Detection Tests
 *
 * Tests the hasHighRecipeIntent function for bilingual support,
 * edge cases, and proper intent classification.
 *
 * This function determines when to force tool use (tool_choice: "required")
 * to prevent the AI from just chatting when the user clearly wants a recipe.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { hasHighRecipeIntent } from "./recipe-intent.ts";

// ============================================================
// English Pattern Tests
// ============================================================

Deno.test("hasHighRecipeIntent - EN: make me a recipe", () => {
  assert(hasHighRecipeIntent("Make me a recipe with chicken"));
});

Deno.test("hasHighRecipeIntent - EN: create a recipe", () => {
  assert(hasHighRecipeIntent("Create a recipe"));
});

Deno.test("hasHighRecipeIntent - EN: generate recipe", () => {
  assert(hasHighRecipeIntent("Generate recipe for dinner"));
});

Deno.test("hasHighRecipeIntent - EN: give me a recipe", () => {
  assert(hasHighRecipeIntent("Give me a recipe please"));
});

Deno.test("hasHighRecipeIntent - EN: recipe for", () => {
  assert(hasHighRecipeIntent("I need a recipe for pasta"));
});

Deno.test("hasHighRecipeIntent - EN: recipe with ingredients", () => {
  assert(hasHighRecipeIntent("Recipe with chicken and rice"));
});

Deno.test("hasHighRecipeIntent - EN: what can I make", () => {
  assert(hasHighRecipeIntent("What can I make for dinner?"));
});

Deno.test("hasHighRecipeIntent - EN: what should I cook", () => {
  assert(hasHighRecipeIntent("What should I cook tonight?"));
});

Deno.test("hasHighRecipeIntent - EN: quick meal", () => {
  assert(hasHighRecipeIntent("I need a quick meal"));
});

Deno.test("hasHighRecipeIntent - EN: 30 minute meal", () => {
  assert(hasHighRecipeIntent("Quick 30-minute meal"));
});

Deno.test("hasHighRecipeIntent - EN: easy dinner", () => {
  assert(hasHighRecipeIntent("Easy dinner ideas"));
});

Deno.test("hasHighRecipeIntent - EN: simple dish", () => {
  assert(hasHighRecipeIntent("Simple dish for tonight"));
});

Deno.test("hasHighRecipeIntent - EN: cook me something", () => {
  assert(hasHighRecipeIntent("Cook me something good"));
});

Deno.test("hasHighRecipeIntent - EN: I want a recipe", () => {
  assert(hasHighRecipeIntent("I want a recipe"));
});

Deno.test("hasHighRecipeIntent - EN: I need a meal", () => {
  assert(hasHighRecipeIntent("I need a meal for 4 people"));
});

Deno.test("hasHighRecipeIntent - EN: help me cook", () => {
  assert(hasHighRecipeIntent("Help me cook dinner"));
});

Deno.test("hasHighRecipeIntent - EN: help me prepare", () => {
  assert(hasHighRecipeIntent("Help me prepare lunch"));
});

// ============================================================
// Spanish Pattern Tests
// ============================================================

Deno.test("hasHighRecipeIntent - ES: hazme una receta", () => {
  assert(hasHighRecipeIntent("Hazme una receta de pollo"));
});

Deno.test("hasHighRecipeIntent - ES: haz una receta", () => {
  assert(hasHighRecipeIntent("Haz una receta"));
});

Deno.test("hasHighRecipeIntent - ES: crea una receta", () => {
  assert(hasHighRecipeIntent("Crea una receta para la cena"));
});

Deno.test("hasHighRecipeIntent - ES: genera receta", () => {
  assert(hasHighRecipeIntent("Genera receta rápida"));
});

Deno.test("hasHighRecipeIntent - ES: dame una receta", () => {
  assert(hasHighRecipeIntent("Dame una receta por favor"));
});

Deno.test("hasHighRecipeIntent - ES: receta de", () => {
  assert(hasHighRecipeIntent("Receta de pasta"));
});

Deno.test("hasHighRecipeIntent - ES: receta con", () => {
  assert(hasHighRecipeIntent("Receta con pollo"));
});

Deno.test("hasHighRecipeIntent - ES: receta para", () => {
  assert(hasHighRecipeIntent("Receta para 4 personas"));
});

Deno.test("hasHighRecipeIntent - ES: qué puedo hacer", () => {
  assert(hasHighRecipeIntent("¿Qué puedo hacer para cenar?"));
});

Deno.test("hasHighRecipeIntent - ES: qué debo cocinar", () => {
  assert(hasHighRecipeIntent("¿Qué debo cocinar hoy?"));
});

Deno.test("hasHighRecipeIntent - ES: que puedo preparar (no accent)", () => {
  assert(hasHighRecipeIntent("Que puedo preparar?"));
});

Deno.test("hasHighRecipeIntent - ES: comida rápida", () => {
  assert(hasHighRecipeIntent("Necesito una comida rápida"));
});

Deno.test("hasHighRecipeIntent - ES: plato fácil", () => {
  assert(hasHighRecipeIntent("Un plato fácil"));
});

Deno.test("hasHighRecipeIntent - ES: cena simple", () => {
  assert(hasHighRecipeIntent("Quiero una cena simple"));
});

Deno.test("hasHighRecipeIntent - ES: rápida comida", () => {
  assert(hasHighRecipeIntent("Rápida comida por favor"));
});

Deno.test("hasHighRecipeIntent - ES: fácil cena", () => {
  assert(hasHighRecipeIntent("Fácil cena para esta noche"));
});

Deno.test("hasHighRecipeIntent - ES: cocíname algo (no accent)", () => {
  // Note: Pattern expects "cocina" without accent
  assert(hasHighRecipeIntent("Cociname algo rico"));
});

Deno.test("hasHighRecipeIntent - ES: quiero una receta", () => {
  assert(hasHighRecipeIntent("Quiero una receta nueva"));
});

Deno.test("hasHighRecipeIntent - ES: quiero un plato", () => {
  assert(hasHighRecipeIntent("Quiero un plato especial"));
});

Deno.test("hasHighRecipeIntent - ES: ayúdame a cocinar", () => {
  assert(hasHighRecipeIntent("Ayúdame a cocinar la cena"));
});

Deno.test("hasHighRecipeIntent - ES: ayudame a preparar (no accent)", () => {
  assert(hasHighRecipeIntent("Ayudame a preparar algo"));
});

Deno.test("hasHighRecipeIntent - ES: prepárame algo", () => {
  assert(hasHighRecipeIntent("Prepárame algo con lo que tengo"));
});

Deno.test("hasHighRecipeIntent - ES: preparame una receta (no accent)", () => {
  assert(hasHighRecipeIntent("Preparame una receta"));
});

// ============================================================
// Negative Tests (should NOT trigger recipe intent)
// ============================================================

Deno.test("hasHighRecipeIntent - negative: simple greeting", () => {
  assertEquals(hasHighRecipeIntent("Hello"), false);
});

Deno.test("hasHighRecipeIntent - negative: general question", () => {
  assertEquals(hasHighRecipeIntent("How are you?"), false);
});

Deno.test("hasHighRecipeIntent - negative: ingredient list only", () => {
  assertEquals(hasHighRecipeIntent("I have chicken and rice"), false);
});

Deno.test("hasHighRecipeIntent - negative: Spanish greeting", () => {
  assertEquals(hasHighRecipeIntent("Hola, ¿cómo estás?"), false);
});

Deno.test("hasHighRecipeIntent - negative: thank you", () => {
  assertEquals(hasHighRecipeIntent("Thank you for the recipe"), false);
});

Deno.test("hasHighRecipeIntent - negative: follow-up question", () => {
  assertEquals(hasHighRecipeIntent("Can you make it spicier?"), false);
});

Deno.test("hasHighRecipeIntent - negative: time question", () => {
  assertEquals(hasHighRecipeIntent("How long does it take?"), false);
});

Deno.test("hasHighRecipeIntent - negative: empty string", () => {
  assertEquals(hasHighRecipeIntent(""), false);
});

Deno.test("hasHighRecipeIntent - negative: whitespace only", () => {
  assertEquals(hasHighRecipeIntent("   "), false);
});

Deno.test("hasHighRecipeIntent - negative: just 'recipe' word", () => {
  // Should require more context than just the word 'recipe'
  assertEquals(hasHighRecipeIntent("recipe"), false);
});

// ============================================================
// Edge Cases
// ============================================================

Deno.test("hasHighRecipeIntent - case insensitive (uppercase)", () => {
  assert(hasHighRecipeIntent("MAKE ME A RECIPE"));
});

Deno.test("hasHighRecipeIntent - case insensitive (mixed)", () => {
  assert(hasHighRecipeIntent("QuIcK 30-MinUTE mEAL"));
});

Deno.test("hasHighRecipeIntent - with extra whitespace", () => {
  assert(hasHighRecipeIntent("   make me a recipe   "));
});

Deno.test("hasHighRecipeIntent - with punctuation", () => {
  assert(hasHighRecipeIntent("What can I make?!"));
});

Deno.test("hasHighRecipeIntent - embedded in longer sentence", () => {
  assert(
    hasHighRecipeIntent(
      "Hey, can you make me a recipe with the chicken I have in the fridge?",
    ),
  );
});

Deno.test("hasHighRecipeIntent - mixed EN/ES", () => {
  // This should match on "recipe for"
  assert(hasHighRecipeIntent("I need a recipe para la cena"));
});

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
import {
  detectModificationHeuristic,
  hasHighRecipeIntent,
} from "../recipe-intent.ts";

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

// ============================================================
// detectModificationHeuristic Tests
// ============================================================

// --- Removal (EN) ---

Deno.test("modHeuristic - EN: remove paprika", () => {
  const r = detectModificationHeuristic("Remove paprika");
  assert(r.isModification);
  assertEquals(r.modifications, "remove paprika");
});

Deno.test("modHeuristic - EN: without onions", () => {
  const r = detectModificationHeuristic("Can you make it without onions?");
  assert(r.isModification);
  assertEquals(r.modifications, "remove onions");
});

Deno.test("modHeuristic - EN: no garlic", () => {
  const r = detectModificationHeuristic("No garlic");
  assert(r.isModification);
  assertEquals(r.modifications, "remove garlic");
});

Deno.test("modHeuristic - EN: skip the cilantro", () => {
  const r = detectModificationHeuristic("Skip the cilantro");
  assert(r.isModification);
  assertEquals(r.modifications, "remove cilantro");
});

Deno.test("modHeuristic - EN: I don't like mushrooms", () => {
  const r = detectModificationHeuristic("I don't like mushrooms");
  assert(r.isModification);
  assertEquals(r.modifications, "remove mushrooms");
});

Deno.test("modHeuristic - EN: I can't eat shellfish", () => {
  const r = detectModificationHeuristic("I can't eat shellfish");
  assert(r.isModification);
  assertEquals(r.modifications, "remove shellfish");
});

Deno.test("modHeuristic - EN: hold the mayo", () => {
  const r = detectModificationHeuristic("Hold the mayo");
  assert(r.isModification);
  assertEquals(r.modifications, "remove mayo");
});

Deno.test("modHeuristic - EN: I'm allergic to peanuts", () => {
  const r = detectModificationHeuristic("I'm allergic to peanuts");
  assert(r.isModification);
  assertEquals(r.modifications, "remove peanuts");
});

// --- Removal (ES) ---

Deno.test("modHeuristic - ES: quita el ajo", () => {
  const r = detectModificationHeuristic("Quita el ajo");
  assert(r.isModification);
  assertEquals(r.modifications, "remove ajo");
});

Deno.test("modHeuristic - ES: sin cebolla", () => {
  const r = detectModificationHeuristic("Sin cebolla");
  assert(r.isModification);
  assertEquals(r.modifications, "remove cebolla");
});

Deno.test("modHeuristic - ES: no pongas sal", () => {
  const r = detectModificationHeuristic("No pongas sal");
  assert(r.isModification);
  assertEquals(r.modifications, "remove sal");
});

Deno.test("modHeuristic - ES: no me gusta el cilantro", () => {
  const r = detectModificationHeuristic("No me gusta el cilantro");
  assert(r.isModification);
  assertEquals(r.modifications, "remove cilantro");
});

Deno.test("modHeuristic - ES: soy alérgico a los mariscos", () => {
  const r = detectModificationHeuristic("Soy alérgico a los mariscos");
  assert(r.isModification);
  // "a los" is consumed by the non-capturing group, capturing only "mariscos"
  assertEquals(r.modifications, "remove mariscos");
});

// --- Adjustment (EN) ---

Deno.test("modHeuristic - EN: make it spicier", () => {
  const r = detectModificationHeuristic("Make it spicier");
  assert(r.isModification);
  assertEquals(r.modifications, "adjust spicier");
});

Deno.test("modHeuristic - EN: less salt", () => {
  const r = detectModificationHeuristic("Less salt please");
  assert(r.isModification);
  assertEquals(r.modifications, "adjust salt");
});

Deno.test("modHeuristic - EN: more spice", () => {
  const r = detectModificationHeuristic("More spice");
  assert(r.isModification);
  assertEquals(r.modifications, "adjust spice");
});

Deno.test("modHeuristic - EN: reduce the sugar", () => {
  const r = detectModificationHeuristic("Reduce the sugar");
  assert(r.isModification);
  assertEquals(r.modifications, "adjust sugar");
});

// --- Adjustment (ES) ---

Deno.test("modHeuristic - ES: más picante", () => {
  const r = detectModificationHeuristic("Más picante");
  assert(r.isModification);
  assertEquals(r.modifications, "adjust picante");
});

Deno.test("modHeuristic - ES: menos dulce", () => {
  const r = detectModificationHeuristic("Menos dulce");
  assert(r.isModification);
  assertEquals(r.modifications, "adjust dulce");
});

// --- Substitution (EN) ---

Deno.test("modHeuristic - EN: replace chicken with tofu", () => {
  const r = detectModificationHeuristic("Replace chicken with tofu");
  assert(r.isModification);
  assertEquals(r.modifications, "replace chicken with tofu");
});

Deno.test("modHeuristic - EN: swap butter for olive oil", () => {
  const r = detectModificationHeuristic("Swap butter for olive oil");
  assert(r.isModification);
  assertEquals(r.modifications, "replace butter with olive oil");
});

// --- Substitution (ES) ---

Deno.test("modHeuristic - ES: cambia pollo por tofu", () => {
  const r = detectModificationHeuristic("Cambia el pollo por tofu");
  assert(r.isModification);
  assertEquals(r.modifications, "replace pollo with tofu");
});

// --- Addition (EN) ---

Deno.test("modHeuristic - EN: add cheese", () => {
  const r = detectModificationHeuristic("Add some cheese");
  assert(r.isModification);
  assertEquals(r.modifications, "add cheese");
});

Deno.test("modHeuristic - EN: can you add bacon", () => {
  const r = detectModificationHeuristic("Can you add bacon?");
  assert(r.isModification);
  assertEquals(r.modifications, "add bacon");
});

// --- Addition (ES) ---

Deno.test("modHeuristic - ES: agrega queso", () => {
  const r = detectModificationHeuristic("Agrega queso");
  assert(r.isModification);
  assertEquals(r.modifications, "add queso");
});

Deno.test("modHeuristic - ES: ponle más ajo", () => {
  const r = detectModificationHeuristic("Ponle más ajo");
  assert(r.isModification);
  assertEquals(r.modifications, "add más ajo");
});

// --- Negative Tests (should NOT detect modification) ---

Deno.test("modHeuristic - negative: hello", () => {
  const r = detectModificationHeuristic("Hello");
  assertEquals(r.isModification, false);
  assertEquals(r.modifications, "");
});

Deno.test("modHeuristic - negative: what time is it", () => {
  const r = detectModificationHeuristic("What time is it?");
  assertEquals(r.isModification, false);
});

Deno.test("modHeuristic - negative: make me a recipe", () => {
  const r = detectModificationHeuristic("Make me a recipe with chicken");
  assertEquals(r.isModification, false);
});

Deno.test("modHeuristic - negative: how long does it take", () => {
  const r = detectModificationHeuristic("How long does it take?");
  assertEquals(r.isModification, false);
});

Deno.test("modHeuristic - negative: empty string", () => {
  const r = detectModificationHeuristic("");
  assertEquals(r.isModification, false);
  assertEquals(r.modifications, "");
});

Deno.test("modHeuristic - negative: thanks", () => {
  const r = detectModificationHeuristic("Thanks, looks great!");
  assertEquals(r.isModification, false);
});

Deno.test("modHeuristic - negative: hola que tal", () => {
  const r = detectModificationHeuristic("Hola, ¿qué tal?");
  assertEquals(r.isModification, false);
});

Deno.test("modHeuristic - negative: tell me about this recipe", () => {
  const r = detectModificationHeuristic("Tell me more about this recipe");
  assertEquals(r.isModification, false);
});

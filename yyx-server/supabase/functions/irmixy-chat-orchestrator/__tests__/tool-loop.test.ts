/**
 * Tool Loop — Tool Gating Tests
 *
 * Tests for resolveExcludedTools which decides which tools to make
 * available based on conversation mode and history.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveExcludedTools } from "../tool-loop.ts";
import { getRegisteredToolNames } from "../../_shared/tools/tool-registry.ts";

// ============================================================
// Helper mode (cookingContext present)
// ============================================================

Deno.test("helper mode: excludes all registered tools", () => {
  const allTools = getRegisteredToolNames();
  const excluded = resolveExcludedTools(
    [],
    { recipeTitle: "Pasta", currentStep: "Step 1" },
  );
  assertEquals(excluded, allTools);
  // Sanity: should have at least the known tools
  assertEquals(excluded.includes("generate_custom_recipe"), true);
  assertEquals(excluded.includes("modify_recipe"), true);
  assertEquals(excluded.includes("search_recipes"), true);
});

Deno.test("helper mode: excludes all tools even when recipe exists in history", () => {
  const allTools = getRegisteredToolNames();
  const excluded = resolveExcludedTools(
    [
      { role: "user", content: "make me pasta" },
      {
        role: "assistant",
        content: "Here's your recipe!",
        metadata: { customRecipe: { name: "Pasta" } },
      },
    ],
    { recipeTitle: "Pasta", currentStep: "Step 1" },
  );
  assertEquals(excluded, allTools);
});

// ============================================================
// General chat — no recipe in history
// ============================================================

Deno.test("general chat: excludes modify_recipe when no recipe in history", () => {
  const excluded = resolveExcludedTools(
    [
      { role: "user", content: "I want to make pasta" },
      { role: "assistant", content: "What kind of pasta?" },
    ],
    undefined,
  );
  assertEquals(excluded, ["modify_recipe"]);
});

Deno.test("general chat: excludes modify_recipe on empty history", () => {
  const excluded = resolveExcludedTools([], undefined);
  assertEquals(excluded, ["modify_recipe"]);
});

// ============================================================
// General chat — recipe exists in history
// ============================================================

Deno.test("general chat: allows modify_recipe when recipe exists in history", () => {
  const excluded = resolveExcludedTools(
    [
      { role: "user", content: "make me pasta" },
      {
        role: "assistant",
        content: "Here's your recipe!",
        metadata: { customRecipe: { name: "Pasta" } },
      },
    ],
    undefined,
  );
  assertEquals(excluded.length, 0);
  assertEquals(excluded.includes("modify_recipe"), false);
});

Deno.test("general chat: allows modify_recipe even with later non-recipe messages", () => {
  const excluded = resolveExcludedTools(
    [
      { role: "user", content: "make me pasta" },
      {
        role: "assistant",
        content: "Here's your recipe!",
        metadata: { customRecipe: { name: "Pasta" } },
      },
      { role: "user", content: "thanks!" },
      { role: "assistant", content: "You're welcome!" },
      { role: "user", content: "can you make it spicier?" },
    ],
    undefined,
  );
  assertEquals(excluded.length, 0);
});

Deno.test("general chat: user messages with metadata don't count as recipe", () => {
  const excluded = resolveExcludedTools(
    [
      {
        role: "user",
        content: "here's my recipe",
        metadata: { customRecipe: { name: "Fake" } },
      },
    ],
    undefined,
  );
  // Only assistant messages with customRecipe count
  assertEquals(excluded, ["modify_recipe"]);
});

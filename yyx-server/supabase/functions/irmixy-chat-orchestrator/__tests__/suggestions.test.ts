import { assertEquals, assertStringIncludes } from "std/assert/mod.ts";
import { buildRecipeConfirmationChip } from "../suggestions.ts";

Deno.test("buildRecipeConfirmationChip — uses recipeDescription as label", () => {
  const chip = buildRecipeConfirmationChip(
    { recipeDescription: "ice cream", ingredients: ["milk", "sugar"] },
  );
  assertEquals(chip.type, "recipe_generation");
  assertStringIncludes(chip.label, "Ice cream");
  assertEquals(chip.metadata?.recipeDescription, "ice cream");
  assertEquals(chip.metadata?.ingredients, ["milk", "sugar"]);
});

Deno.test("buildRecipeConfirmationChip — message is human-readable", () => {
  const chip = buildRecipeConfirmationChip(
    { recipeDescription: "tacos al pastor" },
  );
  assertEquals(chip.message, "tacos al pastor");
});

Deno.test("buildRecipeConfirmationChip — falls back to ingredients when no description", () => {
  const chip = buildRecipeConfirmationChip(
    { ingredients: ["flour", "eggs", "butter"] },
  );
  assertStringIncludes(chip.label, "flour, eggs, butter");
  assertEquals(chip.message, "flour, eggs, butter");
});

Deno.test("buildRecipeConfirmationChip — minimal label when no description or ingredients", () => {
  const chip = buildRecipeConfirmationChip({});
  assertEquals(chip.label, "🍳");
  assertEquals(chip.message, "");
});

Deno.test("buildRecipeConfirmationChip — truncates ingredients to 3", () => {
  const chip = buildRecipeConfirmationChip(
    { ingredients: ["a", "b", "c", "d", "e"] },
  );
  assertStringIncludes(chip.label, "a, b, c");
  assertEquals(chip.label.includes("d"), false);
});

Deno.test("buildRecipeConfirmationChip — metadata contains full tool args", () => {
  const args = {
    recipeDescription: "pasta",
    ingredients: ["tomato"],
    portions: 4,
  };
  const chip = buildRecipeConfirmationChip(args);
  assertEquals(chip.metadata, args);
});

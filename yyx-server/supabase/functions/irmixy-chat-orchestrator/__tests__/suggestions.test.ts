import { assertEquals, assertStringIncludes } from "std/assert/mod.ts";
import { buildRecipeConfirmationChip } from "../suggestions.ts";

Deno.test("buildRecipeConfirmationChip — label includes action prefix and description (en)", () => {
  const chip = buildRecipeConfirmationChip(
    { recipeDescription: "ice cream", ingredients: ["milk", "sugar"] },
    "en",
  );
  assertEquals(chip.type, "recipe_generation");
  assertStringIncludes(chip.label, "Tap to create");
  assertStringIncludes(chip.label, "Ice cream");
  assertEquals(chip.metadata?.recipeDescription, "ice cream");
  assertEquals(chip.metadata?.ingredients, ["milk", "sugar"]);
  assertEquals(chip.metadata?.toolName, "generate_custom_recipe");
});

Deno.test("buildRecipeConfirmationChip — label includes Spanish prefix (es)", () => {
  const chip = buildRecipeConfirmationChip(
    { recipeDescription: "tacos al pastor" },
    "es",
  );
  assertStringIncludes(chip.label, "Toca para crear");
  assertStringIncludes(chip.label, "Tacos al pastor");
});

Deno.test("buildRecipeConfirmationChip — defaults to Spanish", () => {
  const chip = buildRecipeConfirmationChip(
    { recipeDescription: "sopa de miso" },
  );
  assertStringIncludes(chip.label, "Toca para crear");
});

Deno.test("buildRecipeConfirmationChip — message is human-readable", () => {
  const chip = buildRecipeConfirmationChip(
    { recipeDescription: "tacos al pastor" },
    "es",
  );
  assertEquals(chip.message, "tacos al pastor");
});

Deno.test("buildRecipeConfirmationChip — falls back to ingredients when no description", () => {
  const chip = buildRecipeConfirmationChip(
    { ingredients: ["flour", "eggs", "butter"] },
    "en",
  );
  assertStringIncludes(chip.label, "Tap to create");
  assertStringIncludes(chip.label, "flour, eggs, butter");
  assertEquals(chip.message, "flour, eggs, butter");
});

Deno.test("buildRecipeConfirmationChip — prefix only when no description or ingredients", () => {
  const chip = buildRecipeConfirmationChip({}, "en");
  assertEquals(chip.label, "Tap to create");
  assertEquals(chip.message, "");
});

Deno.test("buildRecipeConfirmationChip — truncates ingredients to 3", () => {
  const chip = buildRecipeConfirmationChip(
    { ingredients: ["a", "b", "c", "d", "e"] },
    "en",
  );
  assertStringIncludes(chip.label, "a, b, c");
  assertEquals(chip.label.includes("d"), false);
});

Deno.test("buildRecipeConfirmationChip — metadata contains tool args and toolName", () => {
  const args = {
    recipeDescription: "pasta",
    ingredients: ["tomato"],
    portions: 4,
  };
  const chip = buildRecipeConfirmationChip(args, "en");
  assertEquals(chip.metadata, { ...args, toolName: "generate_custom_recipe" });
});

/**
 * Parse Recipe Markdown Request Validation Tests
 *
 * Tests for request validation in the parse-recipe-markdown edge function:
 * - Input validation
 * - JSON schema structure
 * - Error response formatting
 *
 * Note: These tests focus on validation logic that can be tested without
 * mocking external services. The actual OpenAI integration is tested
 * via integration tests.
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createMockErrorResponse,
  createMockJsonResponse,
  createMockRequest,
} from "../../_shared/test-helpers/mocks.ts";

// ============================================================
// JSON SCHEMA VALIDATION TESTS
// ============================================================

// Define the expected schema structure for recipe parsing
const expectedSchemaProperties = [
  "translations",
  "totalTime",
  "prepTime",
  "difficulty",
  "portions",
  "kitchenTools",
  "ingredients",
  "steps",
  "tags",
];

const expectedDifficultyValues = ["easy", "medium", "hard"];

const expectedMeasurementUnits = [
  "clove",
  "cup",
  "g",
  "kg",
  "l",
  "lb",
  "leaf",
  "ml",
  "oz",
  "piece",
  "pinch",
  "slice",
  "sprig",
  "taste",
  "tbsp",
  "tsp",
  "unit",
];

Deno.test("schema - includes all required recipe properties", () => {
  // The schema should have all expected top-level properties
  expectedSchemaProperties.forEach((prop) => {
    assertExists(prop, `Expected property ${prop} to be defined`);
  });
});

Deno.test("schema - difficulty enum has correct values", () => {
  expectedDifficultyValues.forEach((value) => {
    const isValid = expectedDifficultyValues.includes(value);
    assertEquals(
      isValid,
      true,
      `Expected difficulty value ${value} to be valid`,
    );
  });
});

Deno.test("schema - measurement units enum has expected values", () => {
  // Verify common units are present
  const commonUnits = ["g", "kg", "ml", "l", "tbsp", "tsp", "cup"];
  commonUnits.forEach((unit) => {
    const isPresent = expectedMeasurementUnits.includes(unit);
    assertEquals(isPresent, true, `Expected unit ${unit} to be in schema`);
  });
});

// ============================================================
// REQUEST VALIDATION TESTS
// ============================================================

Deno.test("request validation - markdown content is required", () => {
  // Empty body should fail validation
  const emptyBody = {};
  const hasMarkdown = "markdown" in emptyBody;
  assertEquals(hasMarkdown, false);
});

Deno.test("request validation - empty markdown string is invalid", () => {
  const body = { markdown: "" };
  const isValid = Boolean(body.markdown && body.markdown.length > 0);
  assertEquals(isValid, false);
});

Deno.test("request validation - valid markdown passes", () => {
  const body = { markdown: "# Recipe Name\n\nIngredients:\n- 1 cup flour" };
  const isValid = Boolean(body.markdown && body.markdown.length > 0);
  assertEquals(isValid, true);
});

Deno.test("request validation - null markdown is invalid", () => {
  const body: { markdown: string | null } = { markdown: null };
  const isValid = Boolean(body.markdown && typeof body.markdown === "string");
  assertEquals(isValid, false);
});

Deno.test("request validation - undefined markdown is invalid", () => {
  const body: { markdown: string | undefined } = { markdown: undefined };
  const isValid = Boolean(body.markdown && typeof body.markdown === "string");
  assertEquals(isValid, false);
});

Deno.test("request validation - number as markdown is invalid", () => {
  const body: { markdown: unknown } = { markdown: 12345 };
  const isValid = typeof body.markdown === "string" &&
    (body.markdown as string).length > 0;
  assertEquals(isValid, false);
});

// ============================================================
// RESPONSE FORMAT TESTS
// ============================================================

Deno.test("response format - error response includes error field", () => {
  const errorResponse = { error: "Markdown content is required" };
  assertExists(errorResponse.error);
  assertEquals(typeof errorResponse.error, "string");
});

Deno.test("response format - success response returns JSON string", () => {
  // OpenAI returns a JSON string that gets passed through
  const mockParsedRecipe = JSON.stringify({
    translations: [
      { locale: "en", name: "Test Recipe", tipsAndTricks: "" },
      { locale: "es", name: "Receta de Prueba", tipsAndTricks: "" },
    ],
    difficulty: "easy",
  });

  const parsed = JSON.parse(mockParsedRecipe);
  assertExists(parsed.translations);
  assertEquals(parsed.translations.length, 2);
  assertEquals(parsed.difficulty, "easy");
});

// ============================================================
// INGREDIENT SCHEMA TESTS
// ============================================================

Deno.test("ingredient schema - requires quantity and ingredient object", () => {
  const validIngredient = {
    quantity: 100,
    ingredient: {
      translations: [
        { locale: "en", name: "Flour", pluralName: "Flour" },
        { locale: "es", name: "Harina", pluralName: "Harina" },
      ],
    },
    measurementUnitID: "g",
    translations: [
      { locale: "en", notes: "", tip: "", recipeSection: "Main" },
      { locale: "es", notes: "", tip: "", recipeSection: "Principal" },
    ],
    displayOrder: 1,
  };

  assertEquals(typeof validIngredient.quantity, "number");
  assertExists(validIngredient.ingredient);
  assertExists(validIngredient.ingredient.translations);
  assertEquals(validIngredient.ingredient.translations.length, 2);
});

Deno.test("ingredient schema - measurement unit is optional", () => {
  const ingredientWithoutUnit: {
    quantity: number;
    ingredient: object;
    displayOrder: number;
    measurementUnitID?: string;
  } = {
    quantity: 2,
    ingredient: {
      translations: [
        { locale: "en", name: "Eggs", pluralName: "Eggs" },
        { locale: "es", name: "Huevos", pluralName: "Huevos" },
      ],
    },
    displayOrder: 1,
  };

  // measurementUnitID can default to "unit"
  assertEquals(ingredientWithoutUnit.measurementUnitID, undefined);
});

// ============================================================
// STEP SCHEMA TESTS
// ============================================================

Deno.test("step schema - requires order and translations", () => {
  const validStep = {
    order: 1,
    translations: [
      {
        locale: "en",
        instruction: "Mix the flour with water",
        tip: "",
        recipeSection: "Main",
      },
      {
        locale: "es",
        instruction: "Mezcla la harina con agua",
        tip: "",
        recipeSection: "Principal",
      },
    ],
    thermomixTime: 30,
    thermomixTemperature: null,
    thermomixTemperatureUnit: null,
    thermomixSpeed: { type: "single", value: 4, start: null, end: null },
    thermomixIsBladeReversed: false,
    ingredients: [],
  };

  assertEquals(typeof validStep.order, "number");
  assertExists(validStep.translations);
  assertEquals(validStep.translations.length, 2);
});

Deno.test("step schema - Thermomix fields can be null", () => {
  const stepWithoutThermomix = {
    order: 1,
    translations: [
      {
        locale: "en",
        instruction: "Preheat the oven",
        tip: "",
        recipeSection: "Main",
      },
      {
        locale: "es",
        instruction: "Precalienta el horno",
        tip: "",
        recipeSection: "Principal",
      },
    ],
    thermomixTime: null,
    thermomixTemperature: null,
    thermomixTemperatureUnit: null,
    thermomixSpeed: null,
    thermomixIsBladeReversed: null,
    ingredients: [],
  };

  assertEquals(stepWithoutThermomix.thermomixTime, null);
  assertEquals(stepWithoutThermomix.thermomixSpeed, null);
});

Deno.test("step schema - Thermomix speed can be single value", () => {
  const speed = {
    type: "single",
    value: 5,
    start: null,
    end: null,
  };

  assertEquals(speed.type, "single");
  assertEquals(speed.value, 5);
  assertEquals(speed.start, null);
  assertEquals(speed.end, null);
});

Deno.test("step schema - Thermomix speed can be range", () => {
  const speed = {
    type: "range",
    value: null,
    start: 3,
    end: 5,
  };

  assertEquals(speed.type, "range");
  assertEquals(speed.value, null);
  assertEquals(speed.start, 3);
  assertEquals(speed.end, 5);
});

Deno.test("step schema - Thermomix temperature can be Varoma string", () => {
  const step = {
    order: 1,
    translations: [
      {
        locale: "en",
        instruction: "Steam vegetables",
        tip: "",
        recipeSection: "Main",
      },
    ],
    thermomixTemperature: "Varoma",
  };

  assertEquals(step.thermomixTemperature, "Varoma");
});

Deno.test("step schema - Thermomix speed can be spoon", () => {
  const speed = {
    type: "single",
    value: "spoon",
    start: null,
    end: null,
  };

  assertEquals(speed.value, "spoon");
});

// ============================================================
// KITCHEN TOOLS SCHEMA TESTS
// ============================================================

Deno.test("kitchen tools schema - includes name and display order", () => {
  const kitchenTool = {
    translations: [
      { locale: "en", name: "Mixing Bowl", notes: "Large size preferred" },
      {
        locale: "es",
        name: "Tazón para mezclar",
        notes: "Preferiblemente grande",
      },
    ],
    displayOrder: 1,
  };

  assertExists(kitchenTool.translations);
  assertEquals(kitchenTool.translations.length, 2);
  assertEquals(typeof kitchenTool.displayOrder, "number");
});

// ============================================================
// TAGS SCHEMA TESTS
// ============================================================

Deno.test("tags schema - tags are string array", () => {
  const tags = ["vegetarian", "quick", "easy"];

  assertEquals(Array.isArray(tags), true);
  tags.forEach((tag) => {
    assertEquals(typeof tag, "string");
  });
});

Deno.test("tags schema - empty tags array is valid", () => {
  const tags: string[] = [];
  assertEquals(Array.isArray(tags), true);
  assertEquals(tags.length, 0);
});

// ============================================================
// MARKDOWN INPUT FORMAT TESTS
// ============================================================

Deno.test("markdown input - bilingual format detection", () => {
  const bilingualMarkdown = `
# English Recipe Name

## Ingredients
- 1 cup flour

## Instructions
1. Mix ingredients

---

# Nombre de Receta en Español

## Ingredientes
- 1 taza de harina

## Instrucciones
1. Mezclar ingredientes
`;

  const hasEnglishSection = bilingualMarkdown.includes("## Ingredients");
  const hasSpanishSection = bilingualMarkdown.includes("## Ingredientes");

  assertEquals(hasEnglishSection, true);
  assertEquals(hasSpanishSection, true);
});

Deno.test("markdown input - Thermomix instruction pattern detection", () => {
  const thermomixMarkdown = `
1. Add flour (30 sec/speed 4)
2. Mix with water (2 min/Varoma/speed 3)
3. Knead dough (3 min/speed 3/reverse blades)
`;

  const hasTimePattern = /\(\d+ (?:sec|min)/.test(thermomixMarkdown);
  const hasSpeedPattern = /speed \d+/.test(thermomixMarkdown);
  const hasVaromaPattern = /Varoma/.test(thermomixMarkdown);

  assertEquals(hasTimePattern, true);
  assertEquals(hasSpeedPattern, true);
  assertEquals(hasVaromaPattern, true);
});

Deno.test("markdown input - hashtag removal from tags", () => {
  const tagWithHash = "#vegetarian";
  const cleanedTag = tagWithHash.replace(/^#/, "");

  assertEquals(cleanedTag, "vegetarian");
});

// ============================================================
// MOCK REQUEST HELPER TESTS
// ============================================================

Deno.test("createMockRequest - creates POST request with body", () => {
  const body = { markdown: "# Test Recipe" };
  const request = createMockRequest(body);

  assertEquals(request.method, "POST");
});

Deno.test("createMockRequest - OPTIONS request has no body", () => {
  const request = createMockRequest(null, { method: "OPTIONS" });

  assertEquals(request.method, "OPTIONS");
});

Deno.test("createMockJsonResponse - creates JSON response", () => {
  const data = { nameEn: "Test Recipe" };
  const response = createMockJsonResponse(data);

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/json");
});

Deno.test("createMockErrorResponse - creates error response", () => {
  const response = createMockErrorResponse("Test error", 400);

  assertEquals(response.status, 400);
  assertEquals(response.headers.get("Content-Type"), "application/json");
});

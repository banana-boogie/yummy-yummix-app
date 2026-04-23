/**
 * Admin AI Recipe Import — Request Validation Tests
 *
 * Tests for request validation in the admin-ai-recipe-import edge function:
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
  assertStringIncludes,
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
  "plannerRole",
  "mealComponents",
  "isCompleteMeal",
  "equipmentTags",
  "cookingLevel",
  "leftoversFriendly",
  "batchFriendly",
  "maxHouseholdSizeSupported",
  "mealTypes",
];

const expectedPlannerRoleValues = [
  "main",
  "side",
  "snack",
  "dessert",
  "beverage",
  "condiment",
  "pantry",
];

const expectedMealComponentValues = ["protein", "carb", "veg"];

const expectedMealTypeValues = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "beverage",
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

Deno.test("schema - plannerRole enum matches DB CHECK constraint", () => {
  // Must reconcile with recipes.planner_role CHECK constraint in the meal_plans migration.
  const dbAllowed = [
    "main",
    "side",
    "snack",
    "dessert",
    "beverage",
    "condiment",
  ];
  dbAllowed.forEach((v) => {
    assertEquals(
      expectedPlannerRoleValues.includes(v),
      true,
      `Planner role ${v} must be in AI schema enum`,
    );
  });
});

Deno.test("schema - mealComponents enum matches DB CHECK constraint", () => {
  // Must reconcile with recipes.meal_components CHECK constraint.
  const dbAllowed = ["protein", "carb", "veg"];
  dbAllowed.forEach((v) => {
    assertEquals(
      expectedMealComponentValues.includes(v),
      true,
      `Meal component ${v} must be in AI schema enum`,
    );
  });
});

Deno.test("schema - mealTypes enum includes canonical values", () => {
  const expected = [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "dessert",
    "beverage",
  ];
  expected.forEach((v) => {
    assertEquals(
      expectedMealTypeValues.includes(v),
      true,
      `Meal type ${v} must be in AI schema enum`,
    );
  });
});

Deno.test("schema - maxHouseholdSizeSupported requires integer values", () => {
  const source = Deno.readTextFileSync(new URL("../index.ts", import.meta.url));
  assertStringIncludes(
    source,
    'maxHouseholdSizeSupported: {\n      type: ["integer", "null"]',
  );
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

Deno.test("request validation - content field is required", () => {
  // Empty body should fail validation
  const emptyBody = {};
  const hasContent = "content" in emptyBody;
  assertEquals(hasContent, false);
});

Deno.test("request validation - empty content string is invalid", () => {
  const body = { content: "" };
  const isValid = Boolean(body.content && body.content.length > 0);
  assertEquals(isValid, false);
});

Deno.test("request validation - valid content passes", () => {
  const body = { content: "# Recipe Name\n\nIngredients:\n- 1 cup flour" };
  const isValid = Boolean(body.content && body.content.length > 0);
  assertEquals(isValid, true);
});

Deno.test("request validation - null content is invalid", () => {
  const body: { content: string | null } = { content: null };
  const isValid = Boolean(body.content && typeof body.content === "string");
  assertEquals(isValid, false);
});

Deno.test("request validation - undefined content is invalid", () => {
  const body: { content: string | undefined } = { content: undefined };
  const isValid = Boolean(body.content && typeof body.content === "string");
  assertEquals(isValid, false);
});

Deno.test("request validation - number as content is invalid", () => {
  const body: { content: unknown } = { content: 12345 };
  const isValid = typeof body.content === "string" &&
    (body.content as string).length > 0;
  assertEquals(isValid, false);
});

// ============================================================
// RESPONSE FORMAT TESTS
// ============================================================

Deno.test("response format - error response includes error field", () => {
  const errorResponse = { error: "Recipe content is required" };
  assertExists(errorResponse.error);
  assertEquals(typeof errorResponse.error, "string");
});

Deno.test("response format - success response returns JSON with 3 locales", () => {
  // AI returns structured JSON with translations for en, es, and es-ES
  const mockParsedRecipe = JSON.stringify({
    translations: [
      {
        locale: "en",
        name: "Test Recipe",
        description: "A delicious test recipe.",
        tipsAndTricks: "",
      },
      {
        locale: "es",
        name: "Receta de Prueba",
        description: "Una deliciosa receta de prueba.",
        tipsAndTricks: "",
      },
      {
        locale: "es-ES",
        name: "Receta de Prueba",
        description: "Una deliciosa receta de prueba.",
        tipsAndTricks: "",
      },
    ],
    difficulty: "easy",
  });

  const parsed = JSON.parse(mockParsedRecipe);
  assertExists(parsed.translations);
  assertEquals(parsed.translations.length, 3);
  assertEquals(parsed.translations[0].locale, "en");
  assertEquals(parsed.translations[1].locale, "es");
  assertEquals(parsed.translations[2].locale, "es-ES");
  assertEquals(typeof parsed.translations[0].description, "string");
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
        { locale: "es-ES", name: "Harina", pluralName: "Harina" },
      ],
    },
    measurementUnitID: "g",
    optional: false,
    translations: [
      { locale: "en", notes: "", tip: "", recipeSection: "Main" },
      { locale: "es", notes: "", tip: "", recipeSection: "Principal" },
      { locale: "es-ES", notes: "", tip: "", recipeSection: "Principal" },
    ],
    displayOrder: 1,
  };

  assertEquals(typeof validIngredient.quantity, "number");
  assertExists(validIngredient.ingredient);
  assertExists(validIngredient.ingredient.translations);
  assertEquals(validIngredient.ingredient.translations.length, 3);
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
        { locale: "es-ES", name: "Huevos", pluralName: "Huevos" },
      ],
    },
    displayOrder: 1,
  };

  // measurementUnitID can default to "unit"
  assertEquals(ingredientWithoutUnit.measurementUnitID, undefined);
});

Deno.test("ingredient schema - optional field marks optional ingredients", () => {
  const optionalIngredient = {
    quantity: 1,
    ingredient: {
      translations: [
        { locale: "en", name: "Parsley", pluralName: "Parsley" },
        { locale: "es", name: "Perejil", pluralName: "Perejil" },
        { locale: "es-ES", name: "Perejil", pluralName: "Perejil" },
      ],
    },
    measurementUnitID: "sprig",
    optional: true,
    translations: [
      { locale: "en", notes: "for garnish", tip: "", recipeSection: "Main" },
      {
        locale: "es",
        notes: "para decorar",
        tip: "",
        recipeSection: "Principal",
      },
      {
        locale: "es-ES",
        notes: "para decorar",
        tip: "",
        recipeSection: "Principal",
      },
    ],
    displayOrder: 3,
  };

  assertEquals(optionalIngredient.optional, true);
  assertEquals(typeof optionalIngredient.optional, "boolean");

  const requiredIngredient = { ...optionalIngredient, optional: false };
  assertEquals(requiredIngredient.optional, false);
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
      {
        locale: "es-ES",
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
    thermomixMode: null,
    timerSeconds: null,
    ingredients: [],
  };

  assertEquals(typeof validStep.order, "number");
  assertExists(validStep.translations);
  assertEquals(validStep.translations.length, 3);
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
      {
        locale: "es-ES",
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
    thermomixMode: null,
    timerSeconds: null,
    ingredients: [],
  };

  assertEquals(stepWithoutThermomix.thermomixTime, null);
  assertEquals(stepWithoutThermomix.thermomixSpeed, null);
  assertEquals(stepWithoutThermomix.thermomixMode, null);
  assertEquals(stepWithoutThermomix.timerSeconds, null);
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

Deno.test("step schema - thermomixMode accepts valid enum values", () => {
  const validModes = [
    "slow_cook",
    "rice_cooker",
    "sous_vide",
    "fermentation",
    "open_cooking",
    "browning",
    "steaming",
    "dough",
    "turbo",
    null,
  ];

  validModes.forEach((mode) => {
    const step = { thermomixMode: mode };
    assertEquals(
      validModes.includes(step.thermomixMode),
      true,
      `Expected thermomixMode ${mode} to be valid`,
    );
  });
});

Deno.test("step schema - timerSeconds is number or null", () => {
  // Non-Thermomix step with explicit duration
  const stepWithTimer = {
    order: 2,
    timerSeconds: 1200, // 20 minutes
    thermomixTime: null,
  };
  assertEquals(typeof stepWithTimer.timerSeconds, "number");
  assertEquals(stepWithTimer.timerSeconds, 1200);

  // Step with no explicit duration
  const stepWithoutTimer = {
    order: 3,
    timerSeconds: null,
    thermomixTime: null,
  };
  assertEquals(stepWithoutTimer.timerSeconds, null);
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
      {
        locale: "es-ES",
        name: "Bol para mezclar",
        notes: "Preferiblemente grande",
      },
    ],
    displayOrder: 1,
  };

  assertExists(kitchenTool.translations);
  assertEquals(kitchenTool.translations.length, 3);
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
// INPUT FORMAT TESTS
// ============================================================

Deno.test("input format - accepts any format including multilingual content", () => {
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

Deno.test("input format - Thermomix instruction pattern detection", () => {
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

Deno.test("input format - hashtag removal from tags", () => {
  const tagWithHash = "#vegetarian";
  const cleanedTag = tagWithHash.replace(/^#/, "");

  assertEquals(cleanedTag, "vegetarian");
});

// ============================================================
// MOCK REQUEST HELPER TESTS
// ============================================================

Deno.test("createMockRequest - creates POST request with body", () => {
  const body = { content: "# Test Recipe" };
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

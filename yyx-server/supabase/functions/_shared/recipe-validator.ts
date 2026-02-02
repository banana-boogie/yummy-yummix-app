/**
 * Recipe Schema Validator
 *
 * Ensures AI-generated or user-created recipe data matches the expected structure.
 * Uses JSON Schema validation to guarantee compatibility with the frontend.
 */

/**
 * JSON Schema for user_recipes.recipe_data
 * This matches the RawRecipe structure expected by the frontend.
 */
export const recipeDataSchema = {
  type: "object",
  required: ["name", "difficulty", "ingredients", "steps"],
  properties: {
    name: { type: "string", minLength: 1 },
    name_en: { type: "string" },
    name_es: { type: "string" },
    image_url: { type: "string" },
    difficulty: {
      type: "string",
      enum: ["easy", "medium", "hard"],
    },
    prep_time: { type: "number", minimum: 0 },
    total_time: { type: "number", minimum: 0 },
    portions: { type: "number", minimum: 1 },
    tips_and_tricks_en: { type: "string" },
    tips_and_tricks_es: { type: "string" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        required: ["quantity", "ingredient"],
        properties: {
          quantity: { type: "number" },
          ingredient: {
            type: "object",
            required: ["name_en"],
            properties: {
              id: { type: "string" },
              name_en: { type: "string" },
              name_es: { type: "string" },
              plural_name_en: { type: "string" },
              plural_name_es: { type: "string" },
              image_url: { type: "string" },
            },
          },
          measurement_unit: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["volume", "weight", "unit"] },
              system: {
                type: "string",
                enum: ["metric", "imperial", "universal"],
              },
              name_en: { type: "string" },
              symbol_en: { type: "string" },
            },
          },
          notes_en: { type: "string" },
          notes_es: { type: "string" },
          recipe_section_en: { type: "string" },
          recipe_section_es: { type: "string" },
          display_order: { type: "number" },
          optional: { type: "boolean" },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        required: ["order", "instruction_en"],
        properties: {
          id: { type: "string" },
          order: { type: "number", minimum: 1 },
          instruction_en: { type: "string" },
          instruction_es: { type: "string" },
          recipe_section_en: { type: "string" },
          recipe_section_es: { type: "string" },
          thermomix_time: { type: ["number", "null"] },
          thermomix_speed: { type: ["number", "string", "null"] },
          thermomix_temperature: { type: ["number", "string", "null"] },
          thermomix_is_blade_reversed: { type: ["boolean", "null"] },
          step_ingredients: {
            type: "array",
            items: { type: "object" },
          },
        },
      },
    },
    tags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recipe_tags: {
            type: "object",
            properties: {
              id: { type: "string" },
              name_en: { type: "string" },
              name_es: { type: "string" },
            },
          },
        },
      },
    },
    useful_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          display_order: { type: "number" },
          notes_en: { type: "string" },
          notes_es: { type: "string" },
          useful_item: {
            type: "object",
            properties: {
              id: { type: "string" },
              name_en: { type: "string" },
              name_es: { type: "string" },
              image_url: { type: "string" },
            },
          },
        },
      },
    },
  },
  additionalProperties: true,
};

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate recipe data against the schema.
 * Simple validation without external dependencies.
 */
export function validateRecipeData(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Recipe data must be an object"] };
  }

  const recipe = data as Record<string, unknown>;

  // Required fields
  if (!recipe.name && !recipe.name_en) {
    errors.push("Recipe must have a name (name or name_en)");
  }

  if (!recipe.difficulty) {
    errors.push("Recipe must have a difficulty level");
  } else if (
    !["easy", "medium", "hard"].includes(recipe.difficulty as string)
  ) {
    errors.push('Difficulty must be "easy", "medium", or "hard"');
  }

  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    errors.push("Recipe must have at least one ingredient");
  }

  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    errors.push("Recipe must have at least one step");
  }

  // Validate ingredients structure
  if (Array.isArray(recipe.ingredients)) {
    recipe.ingredients.forEach((ing: any, index: number) => {
      if (typeof ing.quantity !== "number") {
        errors.push(`Ingredient ${index + 1}: quantity must be a number`);
      }
      if (
        !ing.ingredient || (!ing.ingredient.name_en && !ing.ingredient.name)
      ) {
        errors.push(`Ingredient ${index + 1}: must have ingredient name`);
      }
    });
  }

  // Validate steps structure
  if (Array.isArray(recipe.steps)) {
    recipe.steps.forEach((step: any, index: number) => {
      if (typeof step.order !== "number") {
        errors.push(`Step ${index + 1}: order must be a number`);
      }
      if (!step.instruction_en && !step.instruction) {
        errors.push(`Step ${index + 1}: must have instruction text`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize and normalize recipe data before saving.
 * Ensures consistent structure even if AI output varies slightly.
 */
export function normalizeRecipeData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return {
    // Preserve any additional fields first (so normalized values take precedence)
    ...data,

    // Core fields (these override the spread above)
    name: data.name || data.name_en || "Untitled Recipe",
    name_en: data.name_en || data.name || "Untitled Recipe",
    name_es: data.name_es || "",
    image_url: data.image_url || null,
    difficulty: data.difficulty || "medium",
    prep_time: Number(data.prep_time) || 0,
    total_time: Number(data.total_time) || 0,
    portions: Number(data.portions) || 4,
    tips_and_tricks_en: data.tips_and_tricks_en || "",
    tips_and_tricks_es: data.tips_and_tricks_es || "",

    // Arrays with defaults
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    steps: Array.isArray(data.steps) ? data.steps : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    useful_items: Array.isArray(data.useful_items) ? data.useful_items : [],
  };
}

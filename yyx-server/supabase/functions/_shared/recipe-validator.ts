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
  required: ["difficulty", "ingredients", "steps", "translations"],
  properties: {
    image_url: { type: "string" },
    difficulty: {
      type: "string",
      enum: ["easy", "medium", "hard"],
    },
    prep_time: { type: "number", minimum: 0 },
    total_time: { type: "number", minimum: 0 },
    portions: { type: "number", minimum: 1 },
    translations: {
      type: "array",
      items: {
        type: "object",
        required: ["locale", "name"],
        properties: {
          locale: { type: "string" },
          name: { type: "string" },
          tips_and_tricks: { type: "string" },
        },
      },
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        required: ["quantity", "ingredient"],
        properties: {
          quantity: { type: "number" },
          ingredient: {
            type: "object",
            properties: {
              id: { type: "string" },
              image_url: { type: "string" },
              translations: {
                type: "array",
                items: {
                  type: "object",
                  required: ["locale", "name"],
                  properties: {
                    locale: { type: "string" },
                    name: { type: "string" },
                    plural_name: { type: "string" },
                  },
                },
              },
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
              translations: {
                type: "array",
                items: {
                  type: "object",
                  required: ["locale"],
                  properties: {
                    locale: { type: "string" },
                    name: { type: "string" },
                    symbol: { type: "string" },
                  },
                },
              },
            },
          },
          translations: {
            type: "array",
            items: {
              type: "object",
              required: ["locale"],
              properties: {
                locale: { type: "string" },
                notes: { type: "string" },
                recipe_section: { type: "string" },
              },
            },
          },
          display_order: { type: "number" },
          optional: { type: "boolean" },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        required: ["order"],
        properties: {
          id: { type: "string" },
          order: { type: "number", minimum: 1 },
          translations: {
            type: "array",
            items: {
              type: "object",
              required: ["locale", "instruction"],
              properties: {
                locale: { type: "string" },
                instruction: { type: "string" },
                recipe_section: { type: "string" },
              },
            },
          },
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
              translations: {
                type: "array",
                items: {
                  type: "object",
                  required: ["locale", "name"],
                  properties: {
                    locale: { type: "string" },
                    name: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    kitchen_tools: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          display_order: { type: "number" },
          translations: {
            type: "array",
            items: {
              type: "object",
              required: ["locale"],
              properties: {
                locale: { type: "string" },
                notes: { type: "string" },
              },
            },
          },
          kitchen_tool: {
            type: "object",
            properties: {
              id: { type: "string" },
              image_url: { type: "string" },
              translations: {
                type: "array",
                items: {
                  type: "object",
                  required: ["locale", "name"],
                  properties: {
                    locale: { type: "string" },
                    name: { type: "string" },
                  },
                },
              },
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
  if (
    !Array.isArray(recipe.translations) ||
    !(recipe.translations as any[]).some((t: any) => t.name)
  ) {
    errors.push("Recipe must have at least one translation with a name");
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
      } else if (ing.quantity < 0) {
        errors.push(`Ingredient ${index + 1}: quantity cannot be negative`);
      }
      if (
        !ing.ingredient ||
        !Array.isArray(ing.ingredient.translations) ||
        !ing.ingredient.translations.some((t: any) => t.name)
      ) {
        errors.push(
          `Ingredient ${index + 1}: must have ingredient with translations`,
        );
      }
    });
  }

  // Validate steps structure
  if (Array.isArray(recipe.steps)) {
    recipe.steps.forEach((step: any, index: number) => {
      if (typeof step.order !== "number") {
        errors.push(`Step ${index + 1}: order must be a number`);
      }
      if (
        !Array.isArray(step.translations) ||
        !step.translations.some((t: any) => t.instruction)
      ) {
        errors.push(
          `Step ${index + 1}: must have translations with instruction`,
        );
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
  const translations = Array.isArray(data.translations)
    ? data.translations
    : [];
  const firstTranslationName = translations.find(
    (t: any) => t.name,
  )?.name;

  return {
    // Preserve any additional fields first (so normalized values take precedence)
    ...data,

    // Core fields (these override the spread above)
    name: firstTranslationName || "Untitled Recipe",
    image_url: data.image_url || null,
    difficulty: data.difficulty || "medium",
    prep_time: Number(data.prep_time) || 0,
    total_time: Number(data.total_time) || 0,
    portions: Number(data.portions) || 4,
    translations,

    // Arrays with defaults
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    steps: Array.isArray(data.steps) ? data.steps : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    kitchen_tools: Array.isArray(data.kitchen_tools) ? data.kitchen_tools : [],
  };
}

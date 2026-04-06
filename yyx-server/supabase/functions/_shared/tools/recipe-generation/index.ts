/**
 * Recipe Generation Pipeline — barrel export.
 *
 * Re-exports all public API from submodules so consumers can import
 * from a single path: `./recipe-generation/index.ts`
 */

// Types
export type {
  AIUsageLogContext,
  AllergenCheckResult,
  GenerateRecipeResult,
  PartialRecipeCallback,
} from "./types.ts";

// Tool definition
export { generateCustomRecipeTool } from "./tool-definition.ts";

// Allergen checks
export {
  buildAllergenPromptSection,
  checkIngredientsForAllergens,
} from "./allergen-checks.ts";

// Prompts and JSON schema
export {
  buildRecipeGenerationPrompt,
  buildRecipeJsonSchema,
  getSystemPrompt,
} from "./prompts.ts";

// AI call and response parsing
export {
  callRecipeGenerationAI,
  parseAndValidateGeneratedRecipe,
} from "./ai-call.ts";

// Thermomix validation
export {
  parseThermomixSpeed,
  TEMP_REGEX,
  VALID_NUMERIC_SPEEDS,
  VALID_SPECIAL_SPEEDS,
  VALID_SPECIAL_TEMPS,
  validateThermomixSteps,
} from "./thermomix-validation.ts";

// Enrichment
export {
  clearKitchenToolsCache,
  enrichIngredientsWithImages,
  enrichKitchenTools,
  fuzzyMatchToolName,
} from "./enrichment.ts";

/**
 * Suggestion Builder
 *
 * Recipe generation uses a server-side interception pattern:
 * - When the AI calls generate_custom_recipe, the orchestrator intercepts it
 * - A confirmation chip is built from the intercepted tool args (already localized by the AI)
 * - The user taps the chip to confirm — the frontend sends the tool args back via metadata
 * - No hardcoded language strings — the AI handles localization
 */

import type { IrmixyResponse } from "../_shared/irmixy-schemas.ts";

type Suggestion = NonNullable<IrmixyResponse["suggestions"]>[number];

/** Action prefix for the confirmation chip label, keyed by base language. */
const CHIP_PREFIX: Record<string, string> = {
  es: "Toca para crear",
  en: "Tap to create",
};

/**
 * Build a confirmation chip from intercepted generate_custom_recipe tool args.
 *
 * - `label`: action prefix + recipe description — tells the user what tapping does
 * - `message`: human-readable text sent as the user's chat message on tap
 * - `metadata`: the original tool args, sent back via the request body's `confirmedToolCall` field
 */
export function buildRecipeConfirmationChip(
  toolArgs: Record<string, unknown>,
  language: "en" | "es" = "es",
): Suggestion {
  const description = toolArgs.recipeDescription as string | undefined;
  const ingredients = toolArgs.ingredients as string[] | undefined;
  const prefix = CHIP_PREFIX[language] ?? CHIP_PREFIX["en"];

  const recipeName = description
    ? capitalize(description)
    : ingredients?.length
    ? ingredients.slice(0, 3).join(", ")
    : undefined;

  const label = recipeName ? `${prefix}: ${recipeName}` : prefix;

  // Human-readable message — this is what appears in chat history
  const message = description ?? ingredients?.slice(0, 3).join(", ") ?? "";

  return {
    label,
    message,
    type: "recipe_generation",
    metadata: { ...toolArgs, toolName: "generate_custom_recipe" },
  };
}

/** Capitalize the first letter of a string. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

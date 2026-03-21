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

/**
 * Build a confirmation chip from intercepted generate_custom_recipe tool args.
 *
 * - `label`: AI-generated description (already localized), shown to the user
 * - `message`: human-readable text sent as the user's chat message on tap
 * - `metadata`: the original tool args, sent back via the request body's `confirmedToolCall` field
 */
export function buildRecipeConfirmationChip(
  toolArgs: Record<string, unknown>,
): Suggestion {
  const description = toolArgs.recipeDescription as string | undefined;
  const ingredients = toolArgs.ingredients as string[] | undefined;

  const label = description
    ? `🍳 ${capitalize(description)}`
    : ingredients?.length
    ? `🍳 ${ingredients.slice(0, 3).join(", ")}`
    : "🍳";

  // Human-readable message — this is what appears in chat history
  const message = description ?? ingredients?.slice(0, 3).join(", ") ?? "";

  return {
    label,
    message,
    type: "recipe_generation",
    metadata: toolArgs,
  };
}

/** Capitalize the first letter of a string. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

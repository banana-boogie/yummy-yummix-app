/**
 * Action Builder
 *
 * Converts tool results into Action objects for the frontend.
 * Actions render as buttons in chat and can auto-execute.
 */

import type { Action } from "../_shared/irmixy-schemas.ts";
import type { AppActionResult } from "../_shared/tools/app-action.ts";

/** Server-side label map (no i18n available on server). */
const ACTION_LABELS: Record<string, Record<"en" | "es", string>> = {
  share_recipe: { en: "Share Recipe", es: "Compartir Receta" },
  view_recipe: { en: "View Recipe", es: "Ver Receta" },
};

/**
 * Build actions from tool execution results.
 *
 * @param language - User's language for label localization
 * @param appActionResult - Result from the app_action pass-through tool
 * @returns Array of Action objects to include in the response
 */
export function buildActions(
  language: "en" | "es",
  appActionResult?: AppActionResult,
): Action[] {
  const actions: Action[] = [];

  if (appActionResult) {
    const type = appActionResult.action;
    actions.push({
      id: `${type}_${Date.now()}`,
      type,
      label: ACTION_LABELS[type]?.[language] ?? type,
      payload: appActionResult.params,
      autoExecute: true,
    });
  }

  return actions;
}

/**
 * App Action — Pass-through Tool for Frontend-Only Actions
 *
 * Validates action types against an allow-list and passes them through
 * to the frontend via the action system. No server-side work is done.
 */

/** Allowed frontend action types. Add new actions here. */
const ALLOWED_ACTIONS = ["share_recipe"] as const;
export type AppActionType = (typeof ALLOWED_ACTIONS)[number];

export interface AppActionResult {
  action: AppActionType;
  params: Record<string, unknown>;
}

/** AI tool definition for the LLM. */
export const appActionTool = {
  function: {
    name: "app_action",
    description:
      "Trigger a frontend action in the app. Use this for actions that don't require server-side work. " +
      "Available actions: share_recipe (share the current recipe via the device's share sheet). " +
      "Only use this tool when the user explicitly requests one of these actions.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ALLOWED_ACTIONS,
          description:
            "The action to trigger. Must be one of the allowed action types.",
        },
        params: {
          type: "object",
          description:
            "Optional parameters for the action. For share_recipe, no params are needed.",
        },
      },
      required: ["action"],
    },
  },
};

/**
 * Validate and pass through the app action.
 * Returns the validated action or throws on invalid input.
 */
export function executeAppAction(
  args: unknown,
): AppActionResult {
  if (!args || typeof args !== "object") {
    throw new Error("app_action requires an object argument");
  }

  const { action, params } = args as Record<string, unknown>;

  if (typeof action !== "string") {
    throw new Error("app_action requires a string 'action' field");
  }

  if (!ALLOWED_ACTIONS.includes(action as AppActionType)) {
    throw new Error(
      `Unknown action type: ${action}. Allowed: ${ALLOWED_ACTIONS.join(", ")}`,
    );
  }

  return {
    action: action as AppActionType,
    params: (params && typeof params === "object"
      ? params
      : {}) as Record<string, unknown>,
  };
}

/**
 * Orchestrator Configuration
 *
 * Constants for timeouts, heartbeats, and loop limits.
 */

/** Kill the SSE stream after 30s of silence. */
export const STREAM_TIMEOUT_MS = 30_000;

/** Send a heartbeat event every 15s to keep the connection alive. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Maximum iterations for the tool-call loop before giving up. */
export const MAX_TOOL_LOOP_ITERATIONS = 5;

/** Map tool name to a UI status label for the frontend. */
export const TOOL_STATUS: Record<string, string> = {
  search_recipes: "searching",
  retrieve_cooked_recipes: "searching",
  generate_custom_recipe: "cooking_it_up",
  modify_recipe: "cooking_it_up",
};

export function getToolStatus(toolName: string): string {
  return TOOL_STATUS[toolName] ?? "generating";
}

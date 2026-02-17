/**
 * Shared tool response shaping.
 *
 * Both `irmixy-voice-orchestrator` and `irmixy-chat-orchestrator` need to convert raw
 * tool results into a common shape.  Centralising the logic here avoids
 * duplication and keeps the two paths in sync when new tools are added.
 */

import { getToolRegistration, ToolShape } from "./tool-registry.ts";

export interface ShapedToolResponse extends ToolShape {}

export function shapeToolResponse(
  toolName: string,
  result: unknown,
): ShapedToolResponse {
  const tool = getToolRegistration(toolName);
  if (!tool) {
    return { result };
  }

  return tool.shapeResult(result);
}

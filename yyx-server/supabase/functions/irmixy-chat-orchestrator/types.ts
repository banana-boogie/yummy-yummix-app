/**
 * Orchestrator Types
 *
 * Shared type definitions for the Irmixy chat orchestrator.
 */

import type { GenerateRecipeResult } from "../_shared/tools/generate-custom-recipe.ts";
import type { RecipeCard } from "../_shared/irmixy-schemas.ts";
import type { AppActionResult } from "../_shared/tools/app-action.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
  /** Provider-specific metadata (e.g. Gemini thought signatures) */
  metadata?: Record<string, unknown>;
}

export interface RequestContext {
  userContext: import("../_shared/irmixy-schemas.ts").UserContext;
  messages: ChatMessage[];
  planContext?: import("./plan-context.ts").PlanContext | null;
}

export interface ToolExecutionResult {
  toolMessages: ChatMessage[];
  recipes: RecipeCard[] | undefined;
  recipesSourceTool?: string;
  customRecipeResult: GenerateRecipeResult | undefined;
  appActionResult?: AppActionResult;
}

export interface SessionResult {
  sessionId?: string;
  created: boolean;
}

export class SessionOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionOwnershipError";
  }
}

/**
 * Orchestrator Types
 *
 * Shared type definitions for the Irmixy chat orchestrator.
 */

import type { GenerateRecipeResult } from "../_shared/tools/generate-custom-recipe.ts";
import type { RetrieveCustomRecipeResult } from "../_shared/tools/retrieve-custom-recipe.ts";
import type { AppActionResult } from "../_shared/tools/app-action.ts";
import type { RecipeCard } from "../_shared/irmixy-schemas.ts";

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
}

export interface RequestContext {
  userContext: import("../_shared/irmixy-schemas.ts").UserContext;
  messages: ChatMessage[];
}

export interface ToolExecutionResult {
  toolMessages: ChatMessage[];
  recipes: RecipeCard[] | undefined;
  customRecipeResult: GenerateRecipeResult | undefined;
  retrievalResult: RetrieveCustomRecipeResult | undefined;
  appActionResult: AppActionResult | undefined;
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

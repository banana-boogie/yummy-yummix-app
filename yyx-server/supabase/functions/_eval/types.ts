/**
 * AI Model Tournament — Eval Types
 *
 * Local types for the eval framework. Not reusing gateway's AIProvider
 * since it doesn't include xai.
 */

export type EvalProvider = "openai" | "google" | "anthropic" | "xai";

export type EvalRole =
  | "orchestrator"
  | "recipe_generation"
  | "recipe_modification";

export interface ModelConfig {
  id: string;
  provider: EvalProvider;
  apiKeyEnvVar: string;
  capabilities: {
    toolCalling: boolean;
    jsonSchema: boolean;
    reasoning: boolean;
  };
  /** Per-role default reasoning effort */
  reasoningEffort: Partial<
    Record<EvalRole, "minimal" | "low" | "medium" | "high">
  >;
  pricing: {
    inputPerMillion: number;
    outputPerMillion: number;
  };
}

export type EvalStatus = "pass" | "fail" | "skipped";

export interface AttemptDetail {
  attemptNumber: number;
  latencyMs: number;
  costUsd: number;
  error?: string;
}

export interface TestCaseResult {
  modelId: string;
  role: EvalRole;
  testCaseId: string;
  testCaseDescription: string;
  status: EvalStatus;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  reasoningEffort: string | null;
  attempts: AttemptDetail[];
  failureType: "quality" | "transient" | null;
  responseContent: string;
  error?: string;

  // Orchestrator-specific
  toolCalled?: string | null;
  expectedTool?: string | null;
  toolCorrect?: boolean;
  evaluationMethod?: "tool_call" | "intent_analysis";
  turns?: number;

  // Recipe-specific
  jsonValid?: boolean;
  schemaValid?: boolean;
  thermomixPresent?: boolean;
}

export interface RunMetadata {
  timestamp: string;
  gitSha: string;
  denoVersion: string;
  selectedRoles: EvalRole[];
  selectedModels: string[];
  label?: string;
}

export interface TournamentResults {
  metadata: RunMetadata;
  results: TestCaseResult[];
}

/** Test case definition for conversation/orchestrator tests */
export interface ConversationTestCase {
  id: string;
  description: string;
  turns: Array<{
    userMessage: string;
    expectedTool: string | null;
    expectedBehavior: string;
  }>;
}

/** Test case definition for recipe generation tests */
export interface RecipeTestCase {
  id: string;
  description: string;
  ingredients: string[];
  recipeDescription?: string;
  cuisinePreference?: string;
  targetTime?: number;
  difficulty?: "easy" | "medium" | "hard";
  additionalRequests?: string;
}

/** Test case definition for recipe modification tests */
export interface ModificationTestCase {
  id: string;
  description: string;
  modificationRequest: string;
  expectedBehavior: string;
}

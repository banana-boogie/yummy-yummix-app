/**
 * AI Gateway - Types
 *
 * Core type definitions for the multi-provider AI Gateway.
 * Supports routing requests to different models based on usage type.
 */

/** Usage types for routing to appropriate models */
export type AIUsageType =
  | "text"
  | "recipe_generation"
  | "recipe_modification"
  | "translation"
  | "parsing"
  | "embedding";

export type AIProvider = "openai" | "anthropic" | "google" | "xai";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Context for automatic cost recording (fire-and-forget) */
export interface CostContext {
  userId: string;
  edgeFunction: string;
  metadata?: Record<string, unknown>;
}

export interface AICompletionRequest {
  /** The type of usage, used for routing to the appropriate model */
  usageType: AIUsageType;
  /** Conversation messages */
  messages: AIMessage[];
  /** Optional: Override the default model for this usage type */
  model?: string;
  /** Optional: Reasoning effort for GPT-5 family models */
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  /** Optional: Sampling temperature (0-2). Use 1 for deterministic tasks like parsing. Not used with reasoning models. */
  temperature?: number;
  /** Optional: Maximum tokens to generate */
  maxTokens?: number;
  /** Optional: JSON schema for structured output */
  responseFormat?: {
    type: "json_schema";
    schema: Record<string, unknown>;
  };
  /** Optional: Tools the AI can call */
  tools?: AITool[];
  /** Optional: Force tool usage - "required" forces any tool, or specify a function name */
  toolChoice?: "auto" | "required" | {
    type: "function";
    function: { name: string };
  };
  /** Optional: AbortSignal to cancel in-flight requests */
  signal?: AbortSignal;
  /** Optional: Cost context for automatic recording */
  costContext?: CostContext;
}

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  costUsd: number;
  toolCalls?: AIToolCall[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  apiKeyEnvVar: string;
}

export interface AIEmbeddingRequest {
  usageType: "embedding";
  text: string;
  /** Optional: Override the default embedding model */
  model?: string;
  /** Optional: Cost context for automatic recording */
  costContext?: CostContext;
}

export interface AIEmbeddingResponse {
  embedding: number[];
  model: string;
  usage: { inputTokens: number };
  costUsd: number;
}

/** Usage data from a completed stream */
export interface StreamUsageData {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

/** Result from chatStream — provides stream + deferred usage */
export interface AIStreamResult {
  stream: AsyncGenerator<string, void, unknown>;
  usage: () => Promise<StreamUsageData>;
}

/** Configuration mapping usage types to provider/model */
export type AIRoutingConfig = Record<AIUsageType, AIProviderConfig>;

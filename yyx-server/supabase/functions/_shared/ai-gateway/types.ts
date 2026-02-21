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
  | "parsing"
  | "embedding";

export type AIProvider = "openai" | "anthropic" | "google";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
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
}

export interface AIEmbeddingResponse {
  embedding: number[];
  model: string;
  usage: { inputTokens: number };
}

/** Configuration mapping usage types to provider/model */
export type AIRoutingConfig = Record<AIUsageType, AIProviderConfig>;

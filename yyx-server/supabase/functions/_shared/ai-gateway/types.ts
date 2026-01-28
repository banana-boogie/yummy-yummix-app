/**
 * AI Gateway - Types
 *
 * Core type definitions for the multi-provider AI Gateway.
 * Supports routing requests to different models based on usage type.
 */

/** Usage types for routing to appropriate models */
export type AIUsageType =
  | "text"
  | "voice"
  | "parsing"
  | "reasoning"
  | "transcription"
  | "tts";

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
  /** Optional: Temperature (0-2, lower = more deterministic) */
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
}

export interface AITranscriptionRequest {
  /** Audio blob to transcribe */
  audio: Blob;
  /** Optional: Language hint (e.g., 'en', 'es') */
  language?: string;
  /** Optional: Override the default model */
  model?: string;
}

export interface AITranscriptionResponse {
  text: string;
  model: string;
}

export interface AITextToSpeechRequest {
  /** Text to convert to speech */
  text: string;
  /** Voice to use */
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  /** Optional: Override the default model */
  model?: string;
}

export interface AITextToSpeechResponse {
  /** Base64-encoded audio */
  audioBase64: string;
  model: string;
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

/** Configuration mapping usage types to provider/model */
export type AIRoutingConfig = Record<AIUsageType, AIProviderConfig>;

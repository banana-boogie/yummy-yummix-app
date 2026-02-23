/**
 * AI Gateway - Google Gemini Provider
 *
 * Implementation of the AI provider interface for Google Gemini models.
 * Includes: chat completions and streaming chat completions.
 *
 * Translates from the gateway's OpenAI-format interface to Google's
 * Gemini API format. Supports thinking control, tool calling, and
 * structured JSON output.
 */

import {
  AICompletionRequest,
  AICompletionResponse,
  AIMessage,
  AITool,
} from "../types.ts";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

// =============================================================================
// Types
// =============================================================================

interface GeminiPart {
  text?: string;
  thought?: boolean; // Gemini 3 thinking part — filter from output
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  generationConfig?: Record<string, unknown>;
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
  }>;
  toolConfig?: {
    functionCallingConfig: {
      mode: "AUTO" | "ANY" | "NONE";
      allowedFunctionNames?: string[];
    };
  };
}

interface GeminiCandidate {
  content: {
    parts: GeminiPart[];
    role: string;
  };
  finishReason: string;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

// =============================================================================
// Message Translation (exported for testing)
// =============================================================================

/**
 * Translate gateway messages to Gemini format.
 * Extracts system messages into a separate systemInstruction field.
 */
export function translateMessages(
  messages: AIMessage[],
): { contents: GeminiContent[]; systemInstruction?: { parts: GeminiPart[] } } {
  const systemMessages: string[] = [];
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemMessages.push(msg.content);
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  const result: {
    contents: GeminiContent[];
    systemInstruction?: { parts: GeminiPart[] };
  } = {
    contents,
  };

  if (systemMessages.length > 0) {
    result.systemInstruction = {
      parts: [{ text: systemMessages.join("\n\n") }],
    };
  }

  return result;
}

// =============================================================================
// Tool Translation (exported for testing)
// =============================================================================

/**
 * Translate gateway tool choice to Gemini's functionCallingConfig.
 */
export function translateToolChoice(
  toolChoice?: AICompletionRequest["toolChoice"],
): GeminiRequest["toolConfig"] | undefined {
  if (!toolChoice) return undefined;

  if (toolChoice === "auto") {
    return { functionCallingConfig: { mode: "AUTO" } };
  }

  if (toolChoice === "required") {
    return { functionCallingConfig: { mode: "ANY" } };
  }

  // Specific function
  if (typeof toolChoice === "object" && toolChoice.function?.name) {
    return {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: [toolChoice.function.name],
      },
    };
  }

  return undefined;
}

// =============================================================================
// Thinking/Reasoning Config (exported for testing)
// =============================================================================

/**
 * Map gateway reasoningEffort to Gemini thinking configuration.
 * Gemini 3 uses thinkingLevel, Gemini 2.5 uses thinkingBudget.
 */
export function mapReasoningToThinking(
  reasoningEffort: AICompletionRequest["reasoningEffort"],
  model: string,
): Record<string, unknown> | undefined {
  const isGemini3 = model.includes("gemini-3");

  if (isGemini3) {
    // Gemini 3 Flash uses thinkingLevel
    const levelMap: Record<string, string> = {
      minimal: "MINIMAL",
      low: "LOW",
      medium: "MEDIUM",
      high: "HIGH",
    };
    const level = reasoningEffort ? levelMap[reasoningEffort] : "MINIMAL";
    return { thinkingConfig: { thinkingLevel: level || "MINIMAL" } };
  }

  // Gemini 2.5 uses thinkingBudget (token count)
  if (model.includes("gemini-2.5")) {
    const budgetMap: Record<string, number> = {
      minimal: 0,
      low: 1024,
      medium: 8192,
      high: 24576,
    };
    const budget = reasoningEffort ? budgetMap[reasoningEffort] : 0;
    return { thinkingConfig: { thinkingBudget: budget ?? 0 } };
  }

  // Other Gemini models: no thinking config
  return undefined;
}

// =============================================================================
// Response Parsing (exported for testing)
// =============================================================================

/**
 * Parse a Gemini response into the gateway's standard format.
 * Handles text content, tool calls, and safety/recitation blocks.
 */
export function parseGeminiResponse(
  data: GeminiResponse,
  model: string,
): AICompletionResponse {
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Gemini returned no candidates");
  }

  const candidate = data.candidates[0];
  const finishReason = candidate.finishReason;

  // Handle safety blocks
  if (finishReason === "SAFETY") {
    throw new Error(
      "Gemini blocked the response due to safety filters. Try rephrasing the request.",
    );
  }
  if (finishReason === "RECITATION") {
    throw new Error(
      "Gemini blocked the response due to recitation detection. The output may contain copyrighted content.",
    );
  }

  const parts = candidate.content?.parts || [];

  // Extract text content
  const textParts = parts.filter((p) => p.text && !p.thought).map((p) =>
    p.text!
  );
  const content = textParts.join("");

  // Extract tool calls
  const toolCallParts = parts.filter((p) => p.functionCall);
  const toolCalls = toolCallParts.length > 0
    ? toolCallParts.map((p, i) => ({
      id: `gemini-tc-${crypto.randomUUID().slice(0, 8)}-${i}`,
      name: p.functionCall!.name,
      arguments: p.functionCall!.args || {},
    }))
    : undefined;

  return {
    content,
    model: data.modelVersion || model,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
    toolCalls,
  };
}

// =============================================================================
// Schema Translation (exported for testing)
// =============================================================================

/**
 * Translate a JSON schema for Gemini's format.
 * Gemini doesn't support additionalProperties, so we strip it.
 */
export function translateSchemaForGemini(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const translated = { ...schema };

  // Gemini doesn't support additionalProperties — remove it
  delete translated.additionalProperties;

  // Convert type arrays to Gemini-compatible format
  // e.g. { type: ["integer", "null"] } → { type: "integer", nullable: true }
  if (Array.isArray(translated.type)) {
    const types = translated.type as string[];
    const nonNullTypes = types.filter((t) => t !== "null");
    const hasNull = types.includes("null");
    if (nonNullTypes.length >= 1) {
      translated.type = nonNullTypes[0];
    }
    if (hasNull) {
      translated.nullable = true;
    }
  }

  // Recursively clean nested schemas
  if (translated.properties && typeof translated.properties === "object") {
    const cleanedProps: Record<string, unknown> = {};
    for (
      const [key, value] of Object.entries(
        translated.properties as Record<string, unknown>,
      )
    ) {
      if (value && typeof value === "object") {
        cleanedProps[key] = translateSchemaForGemini(
          value as Record<string, unknown>,
        );
      } else {
        cleanedProps[key] = value;
      }
    }
    translated.properties = cleanedProps;
  }

  // Clean array item schemas
  if (translated.items && typeof translated.items === "object") {
    translated.items = translateSchemaForGemini(
      translated.items as Record<string, unknown>,
    );
  }

  return translated;
}

// =============================================================================
// Chat Completions
// =============================================================================

/**
 * Call Google Gemini's generateContent API.
 */
export async function callGemini(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): Promise<AICompletionResponse> {
  const startedAt = performance.now();

  const { contents, systemInstruction } = translateMessages(request.messages);

  const geminiRequest: GeminiRequest = { contents };

  if (systemInstruction) {
    geminiRequest.systemInstruction = systemInstruction;
  }

  // Build generationConfig
  const generationConfig: Record<string, unknown> = {};

  if (request.maxTokens) {
    generationConfig.maxOutputTokens = request.maxTokens;
  }

  if (request.temperature !== undefined) {
    generationConfig.temperature = request.temperature;
  }

  // Add thinking config based on reasoning effort
  const thinkingConfig = mapReasoningToThinking(request.reasoningEffort, model);
  if (thinkingConfig) {
    Object.assign(generationConfig, thinkingConfig);
  }

  // Add structured output (JSON schema)
  if (request.responseFormat) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = translateSchemaForGemini(
      request.responseFormat.schema,
    );
  }

  if (Object.keys(generationConfig).length > 0) {
    geminiRequest.generationConfig = generationConfig;
  }

  // Add tools if specified
  if (request.tools && request.tools.length > 0) {
    geminiRequest.tools = [
      {
        functionDeclarations: request.tools.map((tool: AITool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];

    const toolConfig = translateToolChoice(request.toolChoice);
    if (toolConfig) {
      geminiRequest.toolConfig = toolConfig;
    }
  }

  const url = `${GEMINI_BASE_URL}/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(geminiRequest),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[ai-gateway:google] Chat request failed", {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data: GeminiResponse = await response.json();
  const result = parseGeminiResponse(data, model);

  const durationMs = Math.round(performance.now() - startedAt);
  console.log("[ai-gateway:google] Chat request complete", {
    model: result.model,
    duration_ms: durationMs,
    input_tokens: result.usage.inputTokens,
    output_tokens: result.usage.outputTokens,
    has_tool_calls: !!result.toolCalls?.length,
  });

  return result;
}

// =============================================================================
// Streaming Chat Completions
// =============================================================================

/**
 * Call Google Gemini's streamGenerateContent API.
 * Returns an async generator that yields content chunks.
 */
export async function* callGeminiStream(
  request: AICompletionRequest,
  model: string,
  apiKey: string,
): AsyncGenerator<string, void, unknown> {
  const startedAt = performance.now();

  const { contents, systemInstruction } = translateMessages(request.messages);

  const geminiRequest: GeminiRequest = { contents };

  if (systemInstruction) {
    geminiRequest.systemInstruction = systemInstruction;
  }

  // Build generationConfig
  const generationConfig: Record<string, unknown> = {};

  if (request.maxTokens) {
    generationConfig.maxOutputTokens = request.maxTokens;
  }

  if (request.temperature !== undefined) {
    generationConfig.temperature = request.temperature;
  }

  // Add thinking config
  const thinkingConfig = mapReasoningToThinking(request.reasoningEffort, model);
  if (thinkingConfig) {
    Object.assign(generationConfig, thinkingConfig);
  }

  // Add structured output for streaming (Gemini supports this)
  if (request.responseFormat) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = translateSchemaForGemini(
      request.responseFormat.schema,
    );
  }

  if (Object.keys(generationConfig).length > 0) {
    geminiRequest.generationConfig = generationConfig;
  }

  // Add tools if specified
  if (request.tools && request.tools.length > 0) {
    geminiRequest.tools = [
      {
        functionDeclarations: request.tools.map((tool: AITool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];

    const toolConfig = translateToolChoice(request.toolChoice);
    if (toolConfig) {
      geminiRequest.toolConfig = toolConfig;
    }
  }

  const url = `${GEMINI_BASE_URL}/${model}:streamGenerateContent?alt=sse`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(geminiRequest),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[ai-gateway:google] Stream request failed", {
      model,
      status: response.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  console.log("[ai-gateway:google] Stream connected", {
    model,
    connect_ms: Math.round(performance.now() - startedAt),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const parts = json.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.text && !part.thought) {
              yield part.text;
            }
          }
        }
      } catch {
        console.warn("[ai-gateway:google] Skipped malformed SSE chunk", {
          data: trimmed.slice(6, 200),
        });
      }
    }
  }

  console.log("[ai-gateway:google] Stream completed", {
    model,
    total_ms: Math.round(performance.now() - startedAt),
  });
}

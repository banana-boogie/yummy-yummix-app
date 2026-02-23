/**
 * Google Gemini Provider Tests
 *
 * Tests for internal translation and parsing functions:
 * - Message translation (system extraction, role mapping)
 * - Tool choice translation (auto, required, specific function)
 * - Response parsing (text, tool calls, safety blocks)
 * - Reasoning-to-thinking mapping (Gemini 3 vs 2.5)
 * - Router provider:model override parsing
 */

import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.220.0/assert/mod.ts";
import {
  mapReasoningToThinking,
  parseGeminiResponse,
  translateMessages,
  translateSchemaForGemini,
  translateToolChoice,
} from "../providers/google.ts";
import { parseModelOverride } from "../router.ts";

// =============================================================================
// translateMessages
// =============================================================================

Deno.test("translateMessages - extracts system messages to systemInstruction", () => {
  const result = translateMessages([
    { role: "system", content: "You are a chef." },
    { role: "user", content: "Hello!" },
  ]);

  assertEquals(result.systemInstruction?.parts[0].text, "You are a chef.");
  assertEquals(result.contents.length, 1);
  assertEquals(result.contents[0].role, "user");
  assertEquals(result.contents[0].parts[0].text, "Hello!");
});

Deno.test("translateMessages - concatenates multiple system messages", () => {
  const result = translateMessages([
    { role: "system", content: "Rule one." },
    { role: "system", content: "Rule two." },
    { role: "user", content: "Hi" },
  ]);

  assertEquals(
    result.systemInstruction?.parts[0].text,
    "Rule one.\n\nRule two.",
  );
  assertEquals(result.contents.length, 1);
});

Deno.test("translateMessages - maps assistant to model role", () => {
  const result = translateMessages([
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello!" },
    { role: "user", content: "Thanks" },
  ]);

  assertEquals(result.systemInstruction, undefined);
  assertEquals(result.contents.length, 3);
  assertEquals(result.contents[0].role, "user");
  assertEquals(result.contents[1].role, "model");
  assertEquals(result.contents[2].role, "user");
});

Deno.test("translateMessages - no system messages returns no systemInstruction", () => {
  const result = translateMessages([
    { role: "user", content: "Hi" },
  ]);

  assertEquals(result.systemInstruction, undefined);
  assertEquals(result.contents.length, 1);
});

// =============================================================================
// translateToolChoice
// =============================================================================

Deno.test("translateToolChoice - auto returns AUTO mode", () => {
  const result = translateToolChoice("auto");
  assertEquals(result?.functionCallingConfig.mode, "AUTO");
});

Deno.test("translateToolChoice - required returns ANY mode", () => {
  const result = translateToolChoice("required");
  assertEquals(result?.functionCallingConfig.mode, "ANY");
});

Deno.test("translateToolChoice - specific function returns ANY with allowedFunctionNames", () => {
  const result = translateToolChoice({
    type: "function",
    function: { name: "search_recipes" },
  });
  assertEquals(result?.functionCallingConfig.mode, "ANY");
  assertEquals(result?.functionCallingConfig.allowedFunctionNames, [
    "search_recipes",
  ]);
});

Deno.test("translateToolChoice - undefined returns undefined", () => {
  const result = translateToolChoice(undefined);
  assertEquals(result, undefined);
});

// =============================================================================
// mapReasoningToThinking
// =============================================================================

Deno.test("mapReasoningToThinking - Gemini 3 defaults to MINIMAL", () => {
  const result = mapReasoningToThinking(undefined, "gemini-3-flash-preview");
  assertEquals(result, { thinkingConfig: { thinkingLevel: "MINIMAL" } });
});

Deno.test("mapReasoningToThinking - Gemini 3 maps low to LOW", () => {
  const result = mapReasoningToThinking("low", "gemini-3-flash-preview");
  assertEquals(result, { thinkingConfig: { thinkingLevel: "LOW" } });
});

Deno.test("mapReasoningToThinking - Gemini 3 maps high to HIGH", () => {
  const result = mapReasoningToThinking("high", "gemini-3-flash-preview");
  assertEquals(result, { thinkingConfig: { thinkingLevel: "HIGH" } });
});

Deno.test("mapReasoningToThinking - Gemini 2.5 defaults to budget 0", () => {
  const result = mapReasoningToThinking(undefined, "gemini-2.5-flash");
  assertEquals(result, { thinkingConfig: { thinkingBudget: 0 } });
});

Deno.test("mapReasoningToThinking - Gemini 2.5 maps low to budget 1024", () => {
  const result = mapReasoningToThinking("low", "gemini-2.5-flash");
  assertEquals(result, { thinkingConfig: { thinkingBudget: 1024 } });
});

Deno.test("mapReasoningToThinking - Gemini 2.5 maps high to budget 24576", () => {
  const result = mapReasoningToThinking("high", "gemini-2.5-flash");
  assertEquals(result, { thinkingConfig: { thinkingBudget: 24576 } });
});

Deno.test("mapReasoningToThinking - non-thinking model returns undefined", () => {
  const result = mapReasoningToThinking("low", "gemini-1.5-flash");
  assertEquals(result, undefined);
});

// =============================================================================
// parseGeminiResponse
// =============================================================================

Deno.test("parseGeminiResponse - parses text content", () => {
  const response = {
    candidates: [
      {
        content: {
          parts: [{ text: "Hello world!" }],
          role: "model",
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      totalTokenCount: 15,
    },
    modelVersion: "gemini-3-flash-preview",
  };

  const result = parseGeminiResponse(response, "gemini-3-flash-preview");
  assertEquals(result.content, "Hello world!");
  assertEquals(result.model, "gemini-3-flash-preview");
  assertEquals(result.usage.inputTokens, 10);
  assertEquals(result.usage.outputTokens, 5);
  assertEquals(result.toolCalls, undefined);
});

Deno.test("parseGeminiResponse - parses tool calls with synthetic IDs", () => {
  const response = {
    candidates: [
      {
        content: {
          parts: [
            {
              functionCall: {
                name: "search_recipes",
                args: { query: "pasta" },
              },
            },
          ],
          role: "model",
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: 20,
      candidatesTokenCount: 10,
      totalTokenCount: 30,
    },
  };

  const result = parseGeminiResponse(response, "gemini-3-flash-preview");
  assertEquals(result.content, "");
  assertEquals(result.toolCalls?.length, 1);
  assertEquals(result.toolCalls![0].name, "search_recipes");
  assertEquals(result.toolCalls![0].arguments, { query: "pasta" });
  // Synthetic ID should start with 'gemini-tc-'
  assertEquals(result.toolCalls![0].id.startsWith("gemini-tc-"), true);
});

Deno.test("parseGeminiResponse - throws on SAFETY finish reason", () => {
  const response = {
    candidates: [
      {
        content: { parts: [], role: "model" },
        finishReason: "SAFETY",
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 0,
      totalTokenCount: 10,
    },
  };

  assertThrows(
    () => parseGeminiResponse(response, "gemini-3-flash-preview"),
    Error,
    "safety filters",
  );
});

Deno.test("parseGeminiResponse - throws on RECITATION finish reason", () => {
  const response = {
    candidates: [
      {
        content: { parts: [], role: "model" },
        finishReason: "RECITATION",
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 0,
      totalTokenCount: 10,
    },
  };

  assertThrows(
    () => parseGeminiResponse(response, "gemini-3-flash-preview"),
    Error,
    "recitation",
  );
});

Deno.test("parseGeminiResponse - throws on empty candidates", () => {
  const response = {
    candidates: [],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 0,
      totalTokenCount: 10,
    },
  };

  assertThrows(
    () => parseGeminiResponse(response, "gemini-3-flash-preview"),
    Error,
    "no candidates",
  );
});

Deno.test("parseGeminiResponse - concatenates multiple text parts", () => {
  const response = {
    candidates: [
      {
        content: {
          parts: [{ text: "Hello " }, { text: "world!" }],
          role: "model",
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      totalTokenCount: 15,
    },
  };

  const result = parseGeminiResponse(response, "gemini-3-flash-preview");
  assertEquals(result.content, "Hello world!");
});

Deno.test("parseGeminiResponse - uses modelVersion when present", () => {
  const response = {
    candidates: [
      {
        content: { parts: [{ text: "Hi" }], role: "model" },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: 5,
      candidatesTokenCount: 1,
      totalTokenCount: 6,
    },
    modelVersion: "gemini-3-flash-preview-2026-02",
  };

  const result = parseGeminiResponse(response, "gemini-3-flash-preview");
  assertEquals(result.model, "gemini-3-flash-preview-2026-02");
});

// =============================================================================
// translateSchemaForGemini
// =============================================================================

Deno.test("translateSchemaForGemini - strips top-level additionalProperties", () => {
  const schema = {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
    additionalProperties: false,
  };

  const result = translateSchemaForGemini(schema);
  assertEquals(result.type, "object");
  assertEquals(result.required, ["name"]);
  assertEquals("additionalProperties" in result, false);
});

Deno.test("translateSchemaForGemini - strips nested additionalProperties in properties", () => {
  const schema = {
    type: "object",
    properties: {
      recipe: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  };

  const result = translateSchemaForGemini(schema);
  assertEquals("additionalProperties" in result, false);
  const recipe = result.properties as Record<string, Record<string, unknown>>;
  assertEquals("additionalProperties" in recipe.recipe, false);
  assertEquals(recipe.recipe.type, "object");
});

Deno.test("translateSchemaForGemini - strips additionalProperties in array items", () => {
  const schema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        ingredient: { type: "string" },
      },
      additionalProperties: false,
    },
  };

  const result = translateSchemaForGemini(schema);
  const items = result.items as Record<string, unknown>;
  assertEquals("additionalProperties" in items, false);
  assertEquals(items.type, "object");
});

// =============================================================================
// parseModelOverride (router)
// =============================================================================

const defaultConfig = {
  provider: "google" as const,
  model: "gemini-3-flash-preview",
  apiKeyEnvVar: "GEMINI_API_KEY",
};

Deno.test("parseModelOverride - provider:model switches provider and model", () => {
  const result = parseModelOverride("openai:gpt-4.1-mini", defaultConfig);
  assertEquals(result.provider, "openai");
  assertEquals(result.model, "gpt-4.1-mini");
  assertEquals(result.apiKeyEnvVar, "OPENAI_API_KEY");
});

Deno.test("parseModelOverride - model-only keeps same provider", () => {
  const result = parseModelOverride("gemini-2.5-flash", defaultConfig);
  assertEquals(result.provider, "google");
  assertEquals(result.model, "gemini-2.5-flash");
  assertEquals(result.apiKeyEnvVar, "GEMINI_API_KEY");
});

Deno.test("parseModelOverride - unknown provider falls back to default", () => {
  const result = parseModelOverride("mistral:some-model", defaultConfig);
  assertEquals(result, defaultConfig);
});

Deno.test("parseModelOverride - anthropic provider maps correctly", () => {
  const result = parseModelOverride(
    "anthropic:claude-haiku-4-5-20251001",
    defaultConfig,
  );
  assertEquals(result.provider, "anthropic");
  assertEquals(result.model, "claude-haiku-4-5-20251001");
  assertEquals(result.apiKeyEnvVar, "ANTHROPIC_API_KEY");
});

Deno.test("parseModelOverride - backward compatible with OpenAI-only model name", () => {
  const openaiConfig = {
    provider: "openai" as const,
    model: "gpt-4.1-nano",
    apiKeyEnvVar: "OPENAI_API_KEY",
  };
  const result = parseModelOverride("gpt-5-nano", openaiConfig);
  assertEquals(result.provider, "openai");
  assertEquals(result.model, "gpt-5-nano");
  assertEquals(result.apiKeyEnvVar, "OPENAI_API_KEY");
});

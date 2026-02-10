/**
 * AI Integration
 *
 * Wrappers around the AI Gateway for tool-calling and streaming.
 */

import type {
  AITool,
} from "../_shared/ai-gateway/index.ts";
import {
  chat,
  chatStream,
} from "../_shared/ai-gateway/index.ts";
import { getRegisteredAiTools } from "../_shared/tools/tool-registry.ts";
import { normalizeMessagesForAi } from "./message-normalizer.ts";
import type { OpenAIMessage } from "./types.ts";

/**
 * JSON Schema for structured final responses with suggestions.
 * Used when we want the AI to return formatted output with suggestion chips.
 */
export const STRUCTURED_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "The conversational response message to the user",
    },
    suggestions: {
      type: "array",
      description:
        "Quick suggestion chips for the user to tap. Keep them SHORT (2-5 words, max 30 characters).",
      items: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description:
              "SHORT chip text (2-5 words, max 30 chars). MUST equal message. Examples: 'Make it spicier', 'Add vegetables', 'Less salt'",
            maxLength: 30,
          },
          message: {
            type: "string",
            description:
              "MUST be identical to label. SHORT text (2-5 words, max 30 chars).",
            maxLength: 30,
          },
        },
        required: ["label", "message"],
        additionalProperties: false,
      },
    },
  },
  required: ["message", "suggestions"],
  additionalProperties: false,
};

/**
 * Call AI via the AI Gateway.
 * Supports tools and optional JSON schema for structured output.
 * @param toolChoice - "auto" (default) or "required" (force tool use)
 */
export async function callAI(
  messages: OpenAIMessage[],
  includeTools: boolean = true,
  useStructuredOutput: boolean = false,
  toolChoice?: "auto" | "required",
): Promise<{ choices: Array<{ message: OpenAIMessage }> }> {
  const aiMessages = normalizeMessagesForAi(messages);

  // Convert tools to AI Gateway format
  const tools: AITool[] | undefined = includeTools
    ? getRegisteredAiTools()
    : undefined;

  const response = await chat({
    usageType: "text",
    messages: aiMessages,
    temperature: 0.7,
    tools,
    toolChoice: includeTools ? toolChoice : undefined,
    responseFormat: useStructuredOutput
      ? {
        type: "json_schema",
        schema: STRUCTURED_RESPONSE_SCHEMA,
      }
      : undefined,
  });

  // Convert back to OpenAI response format for compatibility
  return {
    choices: [{
      message: {
        role: "assistant",
        content: response.content,
        tool_calls: response.toolCalls?.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      },
    }],
  };
}

/**
 * Call AI Gateway with streaming.
 * Streams tokens via callback and returns full content.
 */
export async function callAIStream(
  messages: OpenAIMessage[],
  onToken: (token: string) => void,
): Promise<string> {
  const aiMessages = normalizeMessagesForAi(messages);

  let fullContent = "";

  for await (
    const chunk of chatStream({
      usageType: "text",
      messages: aiMessages,
      temperature: 0.7,
    })
  ) {
    fullContent += chunk;
    onToken(chunk);
  }

  return fullContent;
}

/**
 * AI Integration
 *
 * Wrappers around the AI Gateway for tool-calling and streaming.
 */

import type { AITool, CostContext } from "../_shared/ai-gateway/index.ts";
import { chat, chatStreamWithTools } from "../_shared/ai-gateway/index.ts";
import type { AIToolCall } from "../_shared/ai-gateway/types.ts";
import { getRegisteredAiTools } from "../_shared/tools/tool-registry.ts";
import {
  normalizeMessagesForAi,
  normalizeMessagesForToolLoop,
} from "./message-normalizer.ts";
import type { ChatMessage, ToolCall } from "./types.ts";

export interface CallAIResult {
  choices: Array<{ message: ChatMessage }>;
  model: string;
  costUsd: number;
  usage: { inputTokens: number; outputTokens: number };
}

type AIToolChoice = "auto" | "required" | {
  type: "function";
  function: { name: string };
};

/**
 * Call AI via the AI Gateway.
 * Supports tools and tool choice control.
 * @param toolChoice - "auto" (default), "required", or specific function
 */
export async function callAI(
  messages: ChatMessage[],
  includeTools: boolean = true,
  toolChoice: AIToolChoice = "auto",
  signal?: AbortSignal,
  costContext?: CostContext,
): Promise<CallAIResult> {
  const aiMessages = normalizeMessagesForAi(messages);

  // Convert tools to AI Gateway format
  const tools: AITool[] | undefined = includeTools
    ? getRegisteredAiTools()
    : undefined;

  const response = await chat({
    usageType: "text",
    messages: aiMessages,
    tools,
    toolChoice: includeTools ? toolChoice : undefined,
    signal,
    costContext,
  });

  // Convert back to OpenAI response format for compatibility
  return {
    model: response.model,
    costUsd: response.costUsd,
    usage: response.usage,
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

export interface CallAIStreamWithToolsResult {
  content: string;
  toolCalls?: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

/**
 * Stream AI response with tool call support.
 * Text tokens are emitted via onTextToken. Tool calls are returned in the result.
 * Uses native tool messages (not text summaries) to keep the model grounded.
 */
export async function callAIStreamWithTools(
  messages: ChatMessage[],
  onTextToken: (token: string) => void,
  signal?: AbortSignal,
  costContext?: CostContext,
): Promise<CallAIStreamWithToolsResult> {
  const aiMessages = normalizeMessagesForToolLoop(messages);
  const tools: AITool[] = getRegisteredAiTools();

  const result = await chatStreamWithTools({
    usageType: "text",
    messages: aiMessages,
    tools,
    toolChoice: "auto",
    signal,
    costContext,
  });

  let fullContent = "";
  let toolCalls: ToolCall[] | undefined;

  for await (const chunk of result.stream) {
    if (signal?.aborted) break;

    if (chunk.type === "text") {
      fullContent += chunk.text;
      onTextToken(chunk.text);
    } else if (chunk.type === "tool_calls") {
      // Convert AIToolCall[] to orchestrator ToolCall[] format
      toolCalls = chunk.toolCalls.map((tc: AIToolCall) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }
  }

  const usageData = await result.usage();

  return {
    content: fullContent,
    toolCalls,
    usage: {
      inputTokens: usageData.inputTokens,
      outputTokens: usageData.outputTokens,
    },
    model: usageData.model,
  };
}

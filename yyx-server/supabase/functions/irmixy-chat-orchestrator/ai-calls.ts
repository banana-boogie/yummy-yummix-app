/**
 * AI Integration
 *
 * Wrappers around the AI Gateway for tool-calling and streaming.
 */

import type { AITool, CostContext } from "../_shared/ai-gateway/index.ts";
import { chat, chatStream } from "../_shared/ai-gateway/index.ts";
import { getRegisteredAiTools } from "../_shared/tools/tool-registry.ts";
import { normalizeMessagesForAi } from "./message-normalizer.ts";
import type { ChatMessage } from "./types.ts";

export interface CallAIResult {
  choices: Array<{ message: ChatMessage }>;
  model: string;
  costUsd: number;
  usage: { inputTokens: number; outputTokens: number };
}

export interface CallAIStreamResult {
  content: string;
  costUsd: number;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
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

/**
 * Call AI Gateway with streaming.
 * Streams tokens via callback and returns full content + cost/usage.
 */
export async function callAIStream(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
  costContext?: CostContext,
): Promise<CallAIStreamResult> {
  const aiMessages = normalizeMessagesForAi(messages);
  const result = await chatStream({
    usageType: "text",
    messages: aiMessages,
    signal,
    costContext,
  });

  let fullContent = "";

  for await (const chunk of result.stream) {
    if (signal?.aborted) break;
    fullContent += chunk;
    onToken(chunk);
  }

  // Await deferred usage (triggers cost recording if costContext was provided)
  const usageData = await result.usage();

  return {
    content: fullContent,
    costUsd: usageData.costUsd,
    usage: {
      inputTokens: usageData.inputTokens,
      outputTokens: usageData.outputTokens,
    },
    model: usageData.model,
  };
}

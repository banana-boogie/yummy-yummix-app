/**
 * AI Integration
 *
 * Wrappers around the AI Gateway for tool-calling and streaming.
 */

import type { AIStreamUsage, AITool } from "../_shared/ai-gateway/index.ts";
import { chat, chatStream } from "../_shared/ai-gateway/index.ts";
import { getRegisteredAiTools } from "../_shared/tools/tool-registry.ts";
import { normalizeMessagesForAi } from "./message-normalizer.ts";
import type { ChatMessage } from "./types.ts";

export interface CallAIResult {
  choices: Array<{ message: ChatMessage }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
}

export interface CallAIStreamResult {
  content: string;
  usage: AIStreamUsage | null;
  model: string | null;
  streamStatus: "success" | "partial";
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
  });

  // Convert back to OpenAI response format for compatibility
  return {
    model: response.model,
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
    usage: response.usage,
  };
}

/**
 * Call AI Gateway with streaming.
 * Streams tokens via callback and returns full content.
 */
export async function callAIStream(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<CallAIStreamResult> {
  const aiMessages = normalizeMessagesForAi(messages);
  const streamResult = await chatStream({
    usageType: "text",
    messages: aiMessages,
    temperature: 0.7,
    signal,
  });

  let fullContent = "";

  for await (const chunk of streamResult.stream) {
    if (signal?.aborted) break;
    fullContent += chunk;
    onToken(chunk);
  }

  const usage = await streamResult.getUsage();

  return {
    content: fullContent,
    usage,
    model: streamResult.model,
    streamStatus: usage ? "success" : "partial",
  };
}

/**
 * AI Integration
 *
 * Wrappers around the AI Gateway for tool-calling and streaming.
 */

import type { AITool } from "../_shared/ai-gateway/index.ts";
import { chat, chatStream } from "../_shared/ai-gateway/index.ts";
import { getRegisteredAiTools } from "../_shared/tools/tool-registry.ts";
import { normalizeMessagesForAi } from "./message-normalizer.ts";
import type { ChatMessage } from "./types.ts";

/**
 * Call AI via the AI Gateway.
 * Supports tools and tool choice control.
 * @param toolChoice - "auto" (default) or "required" (force tool use)
 */
export async function callAI(
  messages: ChatMessage[],
  includeTools: boolean = true,
  toolChoice?: "auto" | "required",
): Promise<{ choices: Array<{ message: ChatMessage }> }> {
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
  messages: ChatMessage[],
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

import type { AIMessage, AIToolCall } from "../_shared/ai-gateway/index.ts";
import type { ChatMessage } from "./types.ts";

/**
 * Convert orchestrator messages into AI gateway messages for the streaming tool loop.
 * Preserves native tool messages so the AI stays grounded in its tool-calling
 * behavior rather than seeing text summaries.
 */
export function normalizeMessagesForToolLoop(
  messages: ChatMessage[],
): AIMessage[] {
  const aiMessages: AIMessage[] = [];

  for (const m of messages) {
    if (m.role === "system" || m.role === "user") {
      aiMessages.push({ role: m.role, content: m.content || "" });
    } else if (m.role === "assistant") {
      if (m.tool_calls && m.tool_calls.length > 0) {
        // Preserve native tool call format
        const toolCalls: AIToolCall[] = m.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: (() => {
            try {
              return JSON.parse(tc.function.arguments);
            } catch {
              return {};
            }
          })(),
          ...(tc.metadata ? { metadata: tc.metadata } : {}),
        }));
        aiMessages.push({
          role: "assistant",
          content: m.content,
          tool_calls: toolCalls,
        });
      } else {
        aiMessages.push({
          role: "assistant",
          content: m.content || "",
        });
      }
    } else if (m.role === "tool") {
      aiMessages.push({
        role: "tool",
        content: m.content || "",
        tool_call_id: m.tool_call_id || "",
      });
    }
  }

  return aiMessages;
}

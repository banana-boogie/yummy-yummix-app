import type { AIMessage } from "../_shared/ai-gateway/index.ts";
import type { OpenAIMessage } from "./types.ts";

/**
 * Convert orchestrator OpenAI-like messages into AI gateway messages.
 * Tool calls/results are folded into assistant context so follow-up passes
 * remain grounded in tool output for both streaming and non-streaming flows.
 */
export function normalizeMessagesForAi(
  messages: OpenAIMessage[],
): AIMessage[] {
  const aiMessages: AIMessage[] = [];
  let i = 0;

  while (i < messages.length) {
    const m = messages[i];

    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      const parts: string[] = [];
      if (m.content) parts.push(m.content);

      let j = i + 1;
      while (j < messages.length && messages[j].role === "tool") {
        parts.push(`[Tool result]: ${messages[j].content}`);
        j++;
      }

      aiMessages.push({
        role: "assistant",
        content: parts.join("\n"),
      });
      i = j;
      continue;
    }

    if (m.role === "tool") {
      aiMessages.push({
        role: "assistant",
        content: `[Tool result]: ${m.content}`,
      });
      i++;
      continue;
    }

    aiMessages.push({
      role: m.role as "system" | "user" | "assistant",
      content: m.content || "",
    });
    i++;
  }

  return aiMessages;
}

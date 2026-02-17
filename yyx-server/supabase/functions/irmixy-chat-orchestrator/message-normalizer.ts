import type { AIMessage } from "../_shared/ai-gateway/index.ts";
import type { ChatMessage } from "./types.ts";

/**
 * Summarize a raw JSON tool result into a concise, human-readable string.
 * Prevents the AI from echoing raw JSON in its responses.
 */
function summarizeToolContent(content: string): string {
  try {
    const parsed = JSON.parse(content);

    // Error results
    if (parsed?.error) {
      return `Tool error: ${parsed.error}`;
    }

    // Search results (array of recipe cards)
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return "No recipes found.";
      const items = parsed.map((r: Record<string, unknown>) => {
        const parts = [r.name || r.title];
        if (r.totalTime) parts.push(`${r.totalTime} min`);
        if (r.cuisine) parts.push(r.cuisine as string);
        if (
          Array.isArray(r.allergenWarnings) &&
          r.allergenWarnings.length > 0
        ) {
          const warnings = r.allergenWarnings.filter((w): w is string =>
            typeof w === "string" && w.length > 0
          );
          if (warnings.length > 0) {
            parts.push(`Allergen warnings: ${warnings.join("; ")}`);
          }
        }
        if (
          typeof r.allergenVerificationWarning === "string" &&
          r.allergenVerificationWarning.length > 0
        ) {
          parts.push(
            `Verification warning: ${r.allergenVerificationWarning}`,
          );
        }
        return parts.filter(Boolean).join(" - ");
      });
      return `Found ${parsed.length} recipe(s):\n${
        items.map((item: string, i: number) => `${i + 1}. ${item}`).join("\n")
      }`;
    }

    // Custom recipe generation result
    if (parsed?.recipe?.suggestedName) {
      return `Custom recipe generated: "${parsed.recipe.suggestedName}"`;
    }

    // Retrieval result (saved recipes)
    if (parsed?.recipes && Array.isArray(parsed.recipes)) {
      const names = parsed.recipes.map((r: Record<string, unknown>) =>
        r.name || r.title
      ).filter(Boolean);
      return `Found ${parsed.recipes.length} saved recipe(s): ${
        names.join(", ")
      }`;
    }

    // Fallback: for large JSON objects, summarize by listing top-level keys
    if (
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) &&
      content.length > 200
    ) {
      const keys = Object.keys(parsed);
      return `Tool returned object with keys: ${keys.join(", ")}`;
    }

    // Small or non-object JSON: pass through
    return content;
  } catch {
    return content;
  }
}

/**
 * Convert orchestrator OpenAI-like messages into AI gateway messages.
 * Tool calls/results are folded into assistant context so follow-up passes
 * remain grounded in tool output for both streaming and non-streaming flows.
 */
export function normalizeMessagesForAi(
  messages: ChatMessage[],
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
        parts.push(
          `[Tool result]: ${summarizeToolContent(messages[j].content || "")}`,
        );
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
        content: `[Tool result]: ${summarizeToolContent(m.content || "")}`,
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

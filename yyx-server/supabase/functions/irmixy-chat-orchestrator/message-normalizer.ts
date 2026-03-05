import type { AIMessage } from "../_shared/ai-gateway/index.ts";
import type { ChatMessage } from "./types.ts";

/**
 * Summarize a raw JSON tool result into a minimal string.
 * Keeps summaries brief so the AI responds conversationally
 * without echoing recipe details (cards are already shown to the user).
 * Allergen warnings are always preserved for safety.
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

      // Collect allergen warnings (safety-critical — must reach the AI)
      const allergenNotes: string[] = [];
      for (const r of parsed as Record<string, unknown>[]) {
        const name = (r.name || r.title || "A recipe") as string;
        if (
          Array.isArray(r.allergenWarnings) && r.allergenWarnings.length > 0
        ) {
          const warnings = r.allergenWarnings.filter((w): w is string =>
            typeof w === "string" && w.length > 0
          );
          if (warnings.length > 0) {
            allergenNotes.push(`${name}: ${warnings.join("; ")}`);
          }
        }
        if (
          typeof r.allergenVerificationWarning === "string" &&
          r.allergenVerificationWarning.length > 0
        ) {
          allergenNotes.push(
            `Verification: ${r.allergenVerificationWarning}`,
          );
        }
      }

      const names = parsed
        .slice(0, 5)
        .map((r: Record<string, unknown>) => r.name || r.title || "Untitled")
        .join(", ");
      let summary =
        `Found ${parsed.length} recipe(s): ${names}. Results are shown to the user.`;
      if (allergenNotes.length > 0) {
        summary += ` Allergen notes: ${allergenNotes.join(". ")}.`;
      }
      return summary;
    }

    // Custom recipe generation / modification result
    if (parsed?.recipe?.suggestedName) {
      return `Recipe "${parsed.recipe.suggestedName}" is ready and displayed to the user as an interactive card. Do not list ingredients, steps, or parameters — just confirm briefly.`;
    }

    // Retrieval result (saved recipes)
    if (parsed?.recipes && Array.isArray(parsed.recipes)) {
      return `Found ${parsed.recipes.length} saved recipe(s). The user can see them.`;
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
          `The tool returned: ${
            summarizeToolContent(messages[j].content || "")
          }`,
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
        content: `The tool returned: ${summarizeToolContent(m.content || "")}`,
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

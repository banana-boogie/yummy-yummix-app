/**
 * Context Builder
 *
 * Loads and constructs user context for AI interactions.
 * Fetches profile, preferences, conversation history, and cooking sessions.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { UserContext } from "./irmixy-schemas.ts";

const MAX_HISTORY_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 2000;
const MAX_LIST_ITEMS = 20;

/**
 * Sanitize user-provided content to prevent prompt injection.
 * Strips control characters and limits length.
 */
export function sanitizeContent(content: string): string {
  if (!content) return "";
  // Remove control characters (except newlines and tabs)
  // deno-lint-ignore no-control-regex
  const cleaned = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Limit length
  return cleaned.slice(0, MAX_CONTENT_LENGTH);
}

/**
 * Sanitize a list of user-provided strings for prompt safety.
 * Trims, removes control characters, limits length, and caps item count.
 */
function sanitizeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const sanitized: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const cleaned = sanitizeContent(value).trim();
    if (!cleaned) continue;
    sanitized.push(cleaned);
    if (sanitized.length >= MAX_LIST_ITEMS) break;
  }

  return sanitized;
}

/**
 * Normalize the `other_allergy` field into an array of strings.
 * This column may be stored as a string or an array depending on migrations.
 */
function normalizeAllergies(value: unknown): string[] {
  if (Array.isArray(value)) {
    return sanitizeList(value);
  }
  if (typeof value === "string") {
    const cleaned = sanitizeContent(value).trim();
    return cleaned ? [cleaned] : [];
  }
  return [];
}

/**
 * Create a context builder bound to a Supabase client.
 */
export function createContextBuilder(supabase: SupabaseClient) {
  return {
    buildContext: (userId: string, sessionId?: string) =>
      buildContext(supabase, userId, sessionId),
  };
}

/**
 * Build full user context for AI interactions.
 * All user data is now in user_profiles (consolidated from user_context).
 */
async function buildContext(
  supabase: SupabaseClient,
  userId: string,
  sessionId?: string,
): Promise<UserContext> {
  // Fetch user profile and conversation history in parallel
  // Use maybeSingle() to avoid errors when rows don't exist (new users)
  const [profileResult, historyResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(`
        language,
        dietary_restrictions,
        measurement_system,
        diet_types,
        cuisine_preferences,
        other_allergy,
        kitchen_equipment,
        skill_level,
        household_size,
        ingredient_dislikes
      `)
      .eq("id", userId)
      .maybeSingle(),
    sessionId
      ? loadConversationHistory(supabase, sessionId)
      : Promise.resolve([]),
  ]);

  // Log errors but continue with defaults (graceful degradation)
  if (profileResult.error) {
    console.warn("Failed to load user profile:", profileResult.error.message);
  }

  const profile = profileResult.data;

  // Determine language (default: 'en')
  const language: "en" | "es" = profile?.language === "es" ? "es" : "en";

  // Determine measurement system
  // Fallback: imperial for 'en', metric for 'es'
  let measurementSystem: "imperial" | "metric";
  if (profile?.measurement_system) {
    measurementSystem = profile.measurement_system as "imperial" | "metric";
  } else {
    measurementSystem = language === "es" ? "metric" : "imperial";
  }

  // Kitchen equipment (set during onboarding)
  const equipment = sanitizeList(profile?.kitchen_equipment);
  console.log("[Context Builder] Kitchen equipment loaded:", {
    userId,
    equipment,
    count: equipment.length,
  });

  // Diet types - MEDIUM constraint (affects ingredient selection)
  const dietTypes = sanitizeList(profile?.diet_types);

  // Cuisine preferences - SOFT constraint (inspirational, not restrictive)
  const cuisinePreferences = sanitizeList(profile?.cuisine_preferences);
  console.log("[Context Builder] Preferences loaded:", {
    userId,
    dietTypes,
    cuisinePreferences,
  });

  return {
    language,
    measurementSystem,
    dietaryRestrictions: sanitizeList(profile?.dietary_restrictions),
    ingredientDislikes: sanitizeList(profile?.ingredient_dislikes),
    skillLevel: profile?.skill_level || null,
    householdSize: profile?.household_size || null,
    conversationHistory: historyResult as Array<
      { role: string; content: string; metadata?: any }
    >,
    dietTypes,
    cuisinePreferences,
    customAllergies: normalizeAllergies(profile?.other_allergy),
    kitchenEquipment: equipment,
  };
}

/**
 * Summarize stored tool results into a context line for historical messages.
 *
 * Search results: full card attributes (name, time, difficulty, portions, allergens)
 * Generated recipes: name + ingredient names + time + portions + difficulty
 *
 * This gives the model enough context for follow-ups ("which was quicker?",
 * "make it without nuts") without cluttering history with full step-by-step
 * instructions that belong in the cooking guide UI.
 */

type ToolResultSummarizer = (
  data: unknown,
) => string | null;

/** Registry of tool result summarizers. Add new entries here for new tool types. */
const TOOL_SUMMARIZERS: Record<string, ToolResultSummarizer> = {
  recipes: (data) => {
    if (!Array.isArray(data) || data.length === 0) return null;
    const summaries = data.map((r: Record<string, unknown>) => {
      const attrs: string[] = [];
      if (r.name) attrs.push(r.name as string);
      if (r.totalTime) attrs.push(`${r.totalTime} min`);
      if (r.difficulty) attrs.push(r.difficulty as string);
      if (r.portions) attrs.push(`${r.portions} portions`);
      if (
        Array.isArray(r.allergenWarnings) && r.allergenWarnings.length > 0
      ) {
        attrs.push(`allergens: ${r.allergenWarnings.join(", ")}`);
      }
      return attrs.join(", ");
    });
    return `[Showed ${summaries.length} recipe(s): ${summaries.join(" | ")}]`;
  },

  customRecipe: (data) => {
    if (!data || typeof data !== "object") return null;
    const recipe = data as Record<string, unknown>;
    const attrs: string[] = [];
    if (recipe.suggestedName) attrs.push(`"${recipe.suggestedName}"`);
    if (Array.isArray(recipe.ingredients)) {
      const names = recipe.ingredients
        .map((i: Record<string, unknown>) => i.name || i.ingredient)
        .filter(Boolean);
      if (names.length > 0) attrs.push(`ingredients: ${names.join(", ")}`);
    }
    if (recipe.totalTime) attrs.push(`${recipe.totalTime} min`);
    if (recipe.portions) attrs.push(`${recipe.portions} portions`);
    if (recipe.difficulty) attrs.push(recipe.difficulty as string);
    return `[Generated recipe: ${attrs.join(", ")}]`;
  },
};

export function summarizeHistoryToolResults(
  toolCalls: Record<string, unknown>,
): string {
  const parts: string[] = [];
  for (const [key, summarize] of Object.entries(TOOL_SUMMARIZERS)) {
    if (key in toolCalls) {
      const result = summarize(toolCalls[key]);
      if (result) parts.push(result);
    }
  }
  return parts.join(" ");
}

/**
 * Load conversation history for a session.
 * Gets the newest messages, then reverses for chronological order.
 */
async function loadConversationHistory(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<Array<{ role: string; content: string; metadata?: any }>> {
  const { data, error } = await supabase
    .from("user_chat_messages")
    .select("role, content, tool_calls")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);

  if (error) {
    console.error("Failed to load conversation history:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Reverse to get chronological order (oldest first),
  // sanitize content, and enrich assistant messages with tool result summaries
  return data.reverse().map((msg) => {
    let content = sanitizeContent(msg.content);
    if (msg.role === "assistant" && msg.tool_calls) {
      const summary = summarizeHistoryToolResults(msg.tool_calls);
      if (summary) content += `\n${summary}`;
    }
    return { role: msg.role, content, metadata: msg.tool_calls };
  });
}

/**
 * Context Builder
 *
 * Loads and constructs user context for AI interactions.
 * Fetches profile, preferences, conversation history, and cooking sessions.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { UserContext } from './irmixy-schemas.ts';

const MAX_HISTORY_MESSAGES = 10;
const MAX_CONTENT_LENGTH = 2000;

/**
 * Sanitize user-provided content to prevent prompt injection.
 * Strips control characters and limits length.
 */
export function sanitizeContent(content: string): string {
  if (!content) return '';
  // Remove control characters (except newlines and tabs)
  const cleaned = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Limit length
  return cleaned.slice(0, MAX_CONTENT_LENGTH);
}

/**
 * Create a context builder bound to a Supabase client.
 */
export function createContextBuilder(supabase: SupabaseClient) {
  return {
    buildContext: (userId: string, sessionId?: string) =>
      buildContext(supabase, userId, sessionId),
    getResumableCookingSession: (userId: string) =>
      getResumableCookingSession(supabase, userId),
    markStaleSessions: () => markStaleSessions(supabase),
  };
}

/**
 * Build full user context for AI interactions.
 */
async function buildContext(
  supabase: SupabaseClient,
  userId: string,
  sessionId?: string,
): Promise<UserContext> {
  // Fetch user profile and user context in parallel
  // Use maybeSingle() to avoid errors when rows don't exist (new users)
  const [profileResult, contextResult, historyResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('language, dietary_restrictions, measurement_system, diet_types, other_allergy')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_context')
      .select('skill_level, household_size, dietary_restrictions, ingredient_dislikes, kitchen_equipment')
      .eq('user_id', userId)
      .maybeSingle(),
    sessionId
      ? loadConversationHistory(supabase, sessionId)
      : Promise.resolve([]),
  ]);

  // Log errors but continue with defaults (graceful degradation)
  if (profileResult.error) {
    console.warn('Failed to load user profile:', profileResult.error.message);
  }
  if (contextResult.error) {
    console.warn('Failed to load user context:', contextResult.error.message);
  }

  const profile = profileResult.data;
  const userCtx = contextResult.data;

  // Determine language (default: 'en')
  const language: 'en' | 'es' = profile?.language === 'es' ? 'es' : 'en';

  // Determine measurement system from user_profiles (not user_context)
  // Fallback: imperial for 'en', metric for 'es'
  let measurementSystem: 'imperial' | 'metric';
  if (profile?.measurement_system) {
    measurementSystem = profile.measurement_system as 'imperial' | 'metric';
  } else {
    measurementSystem = language === 'es' ? 'metric' : 'imperial';
  }

  // Merge dietary restrictions from both sources
  const profileRestrictions: string[] = profile?.dietary_restrictions || [];
  const contextRestrictions: string[] = userCtx?.dietary_restrictions || [];
  const dietaryRestrictions = [
    ...new Set([...profileRestrictions, ...contextRestrictions]),
  ];

  return {
    language,
    measurementSystem,
    dietaryRestrictions,
    ingredientDislikes: userCtx?.ingredient_dislikes || [],
    skillLevel: userCtx?.skill_level || null,
    householdSize: userCtx?.household_size || null,
    conversationHistory: historyResult as Array<{ role: string; content: string }>,
    // Additional context fields
    dietTypes: profile?.diet_types || [],
    customAllergies: profile?.other_allergy || [],
    kitchenEquipment: userCtx?.kitchen_equipment || [],
  };
}

/**
 * Load conversation history for a session.
 * Gets the newest 10 messages, then reverses for chronological order.
 */
async function loadConversationHistory(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<Array<{ role: string; content: string }>> {
  const { data, error } = await supabase
    .from('user_chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);

  if (error) {
    console.error('Failed to load conversation history:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Reverse to get chronological order (oldest first)
  // and sanitize content
  return data.reverse().map((msg) => ({
    role: msg.role,
    content: sanitizeContent(msg.content),
  }));
}

/**
 * Check for a resumable cooking session (active, within 24h).
 */
async function getResumableCookingSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  recipeName: string;
  currentStep: number;
  totalSteps: number;
  recipeId: string;
} | null> {
  const { data, error } = await supabase
    .from('cooking_sessions')
    .select('id, recipe_id, recipe_name, current_step, total_steps, last_active_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_active_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Check if session is within 24h
  const lastActive = new Date(data.last_active_at);
  const now = new Date();
  const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);

  if (hoursSinceActive > 24) {
    return null;
  }

  return {
    recipeName: data.recipe_name || 'Unknown recipe',
    currentStep: data.current_step,
    totalSteps: data.total_steps,
    recipeId: data.recipe_id || data.id,
  };
}

/**
 * Mark stale cooking sessions as abandoned.
 * Calls the database function that handles >24h sessions.
 */
async function markStaleSessions(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc('mark_stale_cooking_sessions');
  if (error) {
    console.error('Failed to mark stale sessions:', error);
  }
}

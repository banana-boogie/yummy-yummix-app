/**
 * Context Builder
 *
 * Loads and constructs user context for Irmixy AI interactions.
 * Fetches profile data, dietary restrictions, conversation history, and preferences.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { UserContext } from './irmixy-schemas.ts';

interface UserProfile {
  language: string;
  dietary_restrictions: string[] | null;
  diet_types: string[] | null;
}

interface UserContextData {
  skill_level: string | null;
  household_size: number | null;
  ingredient_dislikes: string[] | null;
  dietary_restrictions: string[] | null;
  measurement_system?: 'imperial' | 'metric';
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export class ContextBuilder {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Build complete user context for LLM interactions
   */
  async buildContext(
    userId: string,
    sessionId?: string,
  ): Promise<UserContext> {
    const [profile, context, history] = await Promise.all([
      this.getUserProfile(userId),
      this.getUserContext(userId),
      sessionId ? this.getConversationHistory(sessionId) : [],
    ]);

    // Merge dietary restrictions from both tables
    const allRestrictions = [
      ...(profile.dietary_restrictions || []),
      ...(context.dietary_restrictions || []),
    ];
    const uniqueRestrictions = Array.from(new Set(allRestrictions));

    // Determine measurement system (user preference or default)
    const measurementSystem =
      context.measurement_system ||
      this.getDefaultMeasurementSystem(profile.language);

    return {
      userId,
      language: this.normalizeLanguage(profile.language),
      measurementSystem,
      skillLevel: this.normalizeSkillLevel(context.skill_level),
      householdSize: context.household_size || undefined,
      dietaryRestrictions: uniqueRestrictions,
      ingredientDislikes: context.ingredient_dislikes || [],
      conversationHistory: history.map((msg) => ({
        role: msg.role,
        content: this.sanitizeContent(msg.content),
      })),
    };
  }

  /**
   * Get user profile (language, dietary preferences)
   */
  private async getUserProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('language, dietary_restrictions, diet_types')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return defaults if profile doesn't exist
      return {
        language: 'en',
        dietary_restrictions: [],
        diet_types: [],
      };
    }

    return data;
  }

  /**
   * Get user context (skill level, household size, dislikes)
   */
  private async getUserContext(userId: string): Promise<UserContextData> {
    const { data, error } = await this.supabase
      .from('user_context')
      .select(
        'skill_level, household_size, ingredient_dislikes, dietary_restrictions',
      )
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {
        skill_level: null,
        household_size: null,
        ingredient_dislikes: [],
        dietary_restrictions: [],
      };
    }

    return data;
  }

  /**
   * Get recent conversation history (last 10 messages)
   */
  private async getConversationHistory(
    sessionId: string,
  ): Promise<ConversationMessage[]> {
    const { data, error } = await this.supabase
      .from('user_chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error || !data) {
      return [];
    }

    return data.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      created_at: msg.created_at,
    }));
  }

  /**
   * Normalize language to 'en' or 'es'
   */
  private normalizeLanguage(lang: string | null): 'en' | 'es' {
    if (!lang) return 'en';
    const normalized = lang.toLowerCase().substring(0, 2);
    return normalized === 'es' ? 'es' : 'en';
  }

  /**
   * Normalize skill level
   */
  private normalizeSkillLevel(
    level: string | null,
  ): 'beginner' | 'intermediate' | 'advanced' | undefined {
    if (!level) return undefined;
    const normalized = level.toLowerCase();
    if (normalized === 'beginner' || normalized === 'novice') {
      return 'beginner';
    }
    if (normalized === 'intermediate') return 'intermediate';
    if (normalized === 'advanced' || normalized === 'expert') {
      return 'advanced';
    }
    return undefined;
  }

  /**
   * Get default measurement system based on language
   * (This is just a fallback; explicit user preference takes priority)
   */
  private getDefaultMeasurementSystem(
    language: string,
  ): 'imperial' | 'metric' {
    const lang = this.normalizeLanguage(language);
    // Default: imperial for English, metric for Spanish
    // User can override this in settings
    return lang === 'es' ? 'metric' : 'imperial';
  }

  /**
   * Sanitize message content to prevent prompt injection
   * Removes control characters and limits length
   */
  private sanitizeContent(content: string): string {
    // Remove control characters except newlines and tabs
    const sanitized = content.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Limit length (prevent context overflow)
    const maxLength = 2000;
    if (sanitized.length > maxLength) {
      return sanitized.substring(0, maxLength) + '...';
    }

    return sanitized;
  }

  /**
   * Check for active cooking session that can be resumed
   */
  async getResumableCookingSession(userId: string): Promise<{
    id: string;
    recipeName: string;
    currentStep: number;
    totalSteps: number;
    lastActiveAt: string;
  } | null> {
    const { data, error } = await this.supabase
      .from('cooking_sessions')
      .select('id, recipe_name, current_step, total_steps, last_active_at')
      .eq('user_id', userId)
      .eq('completed', false)
      .eq('abandoned', false)
      .gte('last_active_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within 24h
      .order('last_active_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      recipeName: data.recipe_name,
      currentStep: data.current_step,
      totalSteps: data.total_steps,
      lastActiveAt: data.last_active_at,
    };
  }

  /**
   * Mark stale cooking sessions as abandoned
   * (Should be called periodically or on user login)
   */
  async markStaleSessions(): Promise<number> {
    const { data, error } = await this.supabase.rpc('mark_stale_cooking_sessions');

    if (error) {
      console.error('Failed to mark stale sessions:', error);
      return 0;
    }

    return data || 0;
  }
}

/**
 * Convenience function to create context builder
 */
export function createContextBuilder(
  supabase: SupabaseClient,
): ContextBuilder {
  return new ContextBuilder(supabase);
}

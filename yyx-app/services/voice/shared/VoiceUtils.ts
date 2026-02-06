/**
 * Shared utilities for voice providers
 * Used by both OpenAI Realtime and HearThinkSpeak providers
 */

import type { ConversationContext } from '../types';

/**
 * Build system prompt for voice assistant
 * Shared across all voice providers to ensure consistent behavior
 */
export function buildSystemPrompt(context: ConversationContext): string {
  const { userContext, recipeContext } = context;
  const isSpanish = userContext.language === 'es';
  const lang = isSpanish ? 'Español (México)' : 'English';
  const restrictions = userContext.dietaryRestrictions?.join(', ') || 'none';
  const diets = userContext.dietTypes?.join(', ') || 'none';

  let prompt = `You are Irmixy, YummyYummix's friendly AI sous chef assistant.

CRITICAL: You MUST respond in ${lang} for ALL responses. Never switch languages.

User Profile:
- Preferred Language: ${lang}
- Dietary restrictions: ${restrictions}
- Diet type: ${diets}
- Measurements: ${userContext.measurementSystem}`;

  if (recipeContext) {
    prompt += `

Current Cooking Context:
- Recipe: ${recipeContext.recipeTitle}
- Step ${recipeContext.currentStep} of ${recipeContext.totalSteps}
- Current instruction: ${recipeContext.stepInstructions}`;
  }

  prompt += `

IMPORTANT RULES:
1. Keep ALL responses to 1-2 sentences maximum since they will be spoken aloud.
2. Be warm, encouraging, and helpful.
3. ALWAYS respond in ${lang}, regardless of what language the user speaks.

TOOL USAGE:
- Use search_recipes when the user asks to find, search for, or browse recipes.
- Use generate_custom_recipe when the user wants a custom recipe from ingredients they have.
- After a tool call completes, give a brief spoken summary (e.g., "I found 3 pasta recipes!" or "I created a chicken stir fry recipe for you!").
- The user will see detailed recipe cards on screen — do NOT read out all recipe details, just a short summary.
- Default to limit: 5 for search_recipes unless the user asks for more.`;

  return prompt;
}

/**
 * Keywords that indicate user wants to end conversation
 * Supports both English and Spanish
 */
export const GOODBYE_KEYWORDS = [
  'bye', 'goodbye', 'good bye', 'see you',
  'thanks', 'thank you', "that's all", 'thats all', 'that is all',
  "i'm done", 'im done', "we're done", 'were done',
  'adiós', 'adios', 'hasta luego', 'gracias',
  'eso es todo', 'ya terminé', 'ya termine', 'terminamos'
];

/**
 * Detect if transcript contains goodbye intent
 */
export function detectGoodbye(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  return GOODBYE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Inactivity timer helper
 * Automatically ends conversation after period of silence
 */
export class InactivityTimer {
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Reset timer with new callback
   * Clears existing timer if any
   */
  reset(callback: () => void): void {
    this.clear();
    this.timeoutId = setTimeout(callback, this.timeoutMs);
  }

  /**
   * Clear the timer without triggering callback
   */
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

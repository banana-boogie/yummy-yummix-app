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
  const lang = userContext.language === 'es' ? 'Español (México)' : 'English';
  const restrictions = userContext.dietaryRestrictions?.join(', ') || 'none';
  const diets = userContext.dietTypes?.join(', ') || 'none';

  let prompt = `You are Irmixy, YummyYummix's friendly AI sous chef assistant.

User Profile:
- Language: ${lang}
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

IMPORTANT: Keep ALL responses to 1-2 sentences maximum since they will be spoken aloud. Be warm, encouraging, and helpful.`;

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

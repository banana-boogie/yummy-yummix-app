import { supabase } from '@/lib/supabase';
import { AppState, Platform } from 'react-native';
import logger from '@/services/logger';

type EventType =
  | 'view_recipe'
  | 'cook_start'
  | 'cook_complete'
  | 'search'
  | 'recipe_generate'
  | 'action_execute'
  | 'planner_today_view'
  | 'planner_cook_press'
  | 'planner_swap_press'
  | 'planner_swap_complete'
  | 'planner_week_link_press'
  | 'planner_mode_change'
  | 'planner_pull_to_refresh';
type RecipeTable = 'recipes' | 'user_recipes';

interface QueuedEvent {
  eventType: EventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

// Configuration
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000; // 5 seconds

/**
 * Service for tracking user analytics events.
 *
 * Best practices implemented:
 * 1. Event batching - reduces network calls by batching events
 * 2. Cached user ID - avoids repeated auth calls
 * 3. Fire-and-forget - analytics never blocks the UI
 * 4. Graceful degradation - silent failures, no user impact
 * 5. Flush on visibility change - ensures events are sent before app backgrounds
 */
class EventService {
  private queue: QueuedEvent[] = [];
  private cachedUserId: string | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen for auth state changes to update cached user
    supabase.auth.onAuthStateChange((event, session) => {
      this.cachedUserId = session?.user?.id || null;

      // Flush queue when user logs out
      if (event === 'SIGNED_OUT') {
        this.queue = [];
      }
    });

    // Get initial user
    try {
      const { data: { user } } = await supabase.auth.getUser();
      this.cachedUserId = user?.id || null;
    } catch {
      // Ignore - will be set on next auth state change
    }

    // Flush events when app goes to background (web)
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    // Flush events when app goes to background (native)
    if (Platform.OS !== 'web') {
      this.appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'background' || state === 'inactive') {
          this.flush();
        }
      });
    }

    // Start the flush timer
    this.startFlushTimer();
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Queue an event for batched sending.
   */
  private queueEvent(eventType: EventType, payload: Record<string, unknown>): void {
    if (!this.cachedUserId) {
      // Try to get user synchronously from cache, otherwise skip
      return;
    }

    this.queue.push({
      eventType,
      payload,
      timestamp: new Date().toISOString(),
    });

    // Flush if batch is full
    if (this.queue.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Flush all queued events to the database.
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || !this.cachedUserId) {
      return;
    }

    // Take current queue and clear it
    const eventsToSend = [...this.queue];
    this.queue = [];

    try {
      const rows = eventsToSend.map(event => ({
        user_id: this.cachedUserId,
        event_type: event.eventType,
        payload: event.payload,
        created_at: event.timestamp,
      }));

      const { error } = await supabase.from('user_events').insert(rows);

      if (error) {
        throw error;
      }
    } catch (error) {
      // On failure, add events back to queue (at the front)
      // But only if we haven't accumulated too many
      if (this.queue.length < BATCH_SIZE * 3) {
        this.queue = [...eventsToSend, ...this.queue];
      }
      logger.warn('[eventService] Failed to flush events:', error);
    }
  }

  /**
   * Log when a user views a recipe detail page.
   * Tracks discovery funnel.
   */
  logRecipeView(recipeId: string, recipeName: string): void {
    this.queueEvent('view_recipe', {
      recipe_id: recipeId,
      recipe_name: recipeName,
    });
  }

  /**
   * Log when a user starts cooking a recipe.
   * Tracks activation - user intent to cook.
   */
  logCookStart(
    recipeId: string,
    recipeName: string,
    recipeTable: RecipeTable = 'recipes',
  ): void {
    this.queueEvent('cook_start', {
      recipe_id: recipeId,
      recipe_name: recipeName,
      recipe_table: recipeTable,
    });
  }

  /**
   * Log when a user completes cooking a recipe.
   * Core value metric - user actually cooked something.
   */
  logCookComplete(
    recipeId: string,
    recipeName: string,
    recipeTable: RecipeTable = 'recipes',
  ): void {
    this.queueEvent('cook_complete', {
      recipe_id: recipeId,
      recipe_name: recipeName,
      recipe_table: recipeTable,
    });
  }

  /**
   * Log when a user performs a search.
   * Tracks user intent and discovery behavior.
   */
  logSearch(query: string): void {
    // Only log non-empty searches
    if (!query || query.trim().length === 0) {
      return;
    }
    this.queueEvent('search', {
      query: query.trim(),
    });
  }

  logActionExecute(actionType: string, source: 'auto' | 'manual', path: 'text' | 'voice'): void {
    this.queueEvent('action_execute', {
      actionType,
      source,
      path,
    });
  }

  /**
   * Log which TodayHero variant rendered.
   * Tracks the planner-today funnel and surfaces variant distribution
   * (e.g. catches stale-plan or selector regressions in the wild).
   */
  logPlannerTodayView(params: { variant: string }): void {
    this.queueEvent('planner_today_view', { variant: params.variant });
  }

  /**
   * Log when the user taps "Cocinar esto" on TodayHero.
   * Tracks activation from the daily surface specifically.
   */
  logPlannerCookPress(params: { slotId: string; recipeId: string }): void {
    this.queueEvent('planner_cook_press', {
      slot_id: params.slotId,
      recipe_id: params.recipeId,
    });
  }

  /**
   * Log when the user opens the swap sheet.
   */
  logPlannerSwapPress(params: { slotId: string }): void {
    this.queueEvent('planner_swap_press', { slot_id: params.slotId });
  }

  /**
   * Log when the user picks an alternative from the swap sheet.
   */
  logPlannerSwapComplete(params: {
    slotId: string;
    newRecipeId: string | null;
  }): void {
    this.queueEvent('planner_swap_complete', {
      slot_id: params.slotId,
      new_recipe_id: params.newRecipeId,
    });
  }

  /**
   * Log when the user taps the "see my menu for the week" link below TodayHero.
   * Distinct from logPlannerModeChange — that event covers all triggers; this
   * one is specifically the link.
   */
  logPlannerWeekLinkPress(): void {
    this.queueEvent('planner_week_link_press', {});
  }

  /**
   * Log when the menu surface toggles between today and week mode.
   * Substitutes for route-based page-view tracking since URL doesn't change.
   */
  logPlannerModeChange(params: {
    from: 'today' | 'week';
    to: 'today' | 'week';
    trigger: 'link' | 'back-button' | 'hardware-back';
  }): void {
    this.queueEvent('planner_mode_change', {
      from: params.from,
      to: params.to,
      trigger: params.trigger,
    });
  }

  /**
   * Log when the user pulls TodayHero to refresh.
   */
  logPlannerPullToRefresh(): void {
    this.queueEvent('planner_pull_to_refresh', {});
  }

  /**
   * Log when AI custom recipe generation succeeds or fails.
   */
  logRecipeGenerate(
    recipeName: string,
    success: boolean,
    durationMs: number
  ): void {
    this.queueEvent('recipe_generate', {
      recipe_name: recipeName,
      success,
      duration_ms: Math.round(durationMs),
    });
  }

  /**
   * Clean up resources. Call this when the service is no longer needed.
   * Flushes remaining events and clears the interval timer.
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Clean up AppState listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Clean up web visibility listener
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.flush();
  }
}

// Export singleton instance
export const eventService = new EventService();

export default eventService;

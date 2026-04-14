import { supabase } from '@/lib/supabase';
import { AppState, Platform } from 'react-native';
import logger from '@/services/logger';
import type {
  AnalyticsEnvelope,
  AnalyticsEnvelopeInput,
  AnalyticsEvent,
  EventName,
} from './analytics/eventTypes';

type RecipeTable = 'recipes' | 'user_recipes';

interface QueuedEvent {
  eventType: EventName;
  payload: Record<string, unknown>;
  envelope: AnalyticsEnvelope;
  timestamp: string;
}

/**
 * Default envelope used by legacy `logXxx` helpers and internal queuing.
 *
 * Legacy helpers pre-date the envelope contract and have no caller-supplied
 * locale/sourceSurface. We default to empty strings so the types hold; feature
 * PRs that migrate these call-sites to `trackEvent({...}, {...})` should
 * supply real values.
 */
const LEGACY_ENVELOPE_INPUT: AnalyticsEnvelopeInput = {
  locale: '',
  sourceSurface: null,
};

function derivePlatform(): AnalyticsEnvelope['appPlatform'] {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

function buildEnvelope(input: AnalyticsEnvelopeInput): AnalyticsEnvelope {
  return {
    locale: input.locale,
    sourceSurface: input.sourceSurface,
    appPlatform: derivePlatform(),
  };
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
   * Strictly-typed event tracking entry point.
   *
   * Accepts a discriminated `AnalyticsEvent` object (`{ name, payload }`) plus
   * the caller-supplied envelope input (`{ locale, sourceSurface }`).
   * `appPlatform` is derived automatically from `Platform.OS`.
   *
   * Usage:
   *   eventService.trackEvent(
   *     { name: 'meal_plan_approved', payload: { mealPlanId, weekStart, ... } },
   *     { locale: 'es-MX', sourceSurface: 'planner' },
   *   );
   *
   * Why the discriminated-object shape: if the two arguments were separate
   * (`name`, `payload`), a caller could widen `name` to `EventName` via a
   * variable, collapsing the payload type to the union of all payloads and
   * letting mismatched pairs compile. Forcing the caller to construct a
   * single `AnalyticsEvent` first keeps the name/payload correlation under
   * the discriminated union, so TypeScript rejects mismatches.
   *
   * NOTE: Call-sites for planner/shopping/explore/chat events are intentionally
   * NOT wired up in this PR — feature PRs wire them in.
   */
  trackEvent(event: AnalyticsEvent, envelopeInput: AnalyticsEnvelopeInput): void {
    this.queueEvent(
      event.name,
      event.payload as unknown as Record<string, unknown>,
      buildEnvelope(envelopeInput),
    );
  }

  /**
   * Queue an event for batched sending.
   */
  private queueEvent(
    eventType: EventName,
    payload: Record<string, unknown>,
    envelope: AnalyticsEnvelope,
  ): void {
    if (!this.cachedUserId) {
      // Try to get user synchronously from cache, otherwise skip
      return;
    }

    this.queue.push({
      eventType,
      payload,
      envelope,
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
        // TODO(analytics-envelope-migration): once the `user_events` table has
        // dedicated `locale`, `app_platform`, and `source_surface` columns,
        // persist `event.envelope` fields as top-level columns instead of
        // flattening into `payload`. Tracked against Plan 06 (analytics
        // backfill migration). For now, we flatten so the envelope data is
        // still captured end-to-end without requiring a schema change.
        payload: {
          ...event.payload,
          _envelope: event.envelope,
        },
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
    this.queueEvent(
      'view_recipe',
      {
        recipe_id: recipeId,
        recipe_name: recipeName,
      },
      buildEnvelope(LEGACY_ENVELOPE_INPUT),
    );
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
    this.queueEvent(
      'cook_start',
      {
        recipe_id: recipeId,
        recipe_name: recipeName,
        recipe_table: recipeTable,
      },
      buildEnvelope(LEGACY_ENVELOPE_INPUT),
    );
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
    this.queueEvent(
      'cook_complete',
      {
        recipe_id: recipeId,
        recipe_name: recipeName,
        recipe_table: recipeTable,
      },
      buildEnvelope(LEGACY_ENVELOPE_INPUT),
    );
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
    this.queueEvent(
      'search',
      {
        query: query.trim(),
      },
      buildEnvelope(LEGACY_ENVELOPE_INPUT),
    );
  }

  logActionExecute(actionType: string, source: 'auto' | 'manual', path: 'text' | 'voice'): void {
    this.queueEvent(
      'action_execute',
      {
        actionType,
        source,
        path,
      },
      buildEnvelope(LEGACY_ENVELOPE_INPUT),
    );
  }

  /**
   * Log when AI custom recipe generation succeeds or fails.
   */
  logRecipeGenerate(
    recipeName: string,
    success: boolean,
    durationMs: number
  ): void {
    this.queueEvent(
      'recipe_generate',
      {
        recipe_name: recipeName,
        success,
        duration_ms: Math.round(durationMs),
      },
      buildEnvelope(LEGACY_ENVELOPE_INPUT),
    );
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

export type {
  EventName,
  EventPayload,
  EventPayloadMap,
  AnalyticsEvent,
  AnalyticsEnvelope,
  AnalyticsEnvelopeInput,
} from './analytics/eventTypes';

export default eventService;

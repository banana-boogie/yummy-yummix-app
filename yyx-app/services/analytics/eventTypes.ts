/**
 * Analytics event types and payload shapes.
 *
 * Authoritative reference:
 *   product-kitchen/repeat-what-works/plans/06-analytics-and-metrics.md
 *
 * Conventions:
 * - Event names use snake_case (matches Plan 06 naming convention).
 * - Payload keys use camelCase (matches Plan 06 TypeScript interfaces and
 *   the existing `action_execute` event).
 * - Pre-existing legacy events (`view_recipe`, `cook_start`, `cook_complete`,
 *   `search`, `recipe_generate`) keep their original snake_case payload keys
 *   for backwards compatibility — they pre-date this convention.
 *
 * Common envelope:
 * - Every tracked event carries an `AnalyticsEnvelope` alongside its payload,
 *   per Plan 06's "common envelope" spec. The envelope holds cross-cutting
 *   metadata (`locale`, `appPlatform`, `sourceSurface`) that was previously
 *   hand-rolled onto individual payloads. `eventService.trackEvent(...)`
 *   derives `appPlatform` automatically from `Platform.OS`; callers supply
 *   `{ locale, sourceSurface }`.
 *
 * These types are types-only: they describe what events may be emitted and
 * what payloads they carry. Feature PRs wire up the actual `trackEvent(...)`
 * call-sites.
 */

// -----------------------------------------------------------------------------
// Common envelope (shared analytics metadata — attached to every event)
// -----------------------------------------------------------------------------

/**
 * Common metadata attached to every analytics event.
 *
 * - `locale`: user's current UI locale, e.g., `'en'`, `'es'`, `'es-MX'`.
 * - `appPlatform`: runtime platform (derived by eventService from Platform.OS).
 * - `sourceSurface`: the UI surface that originated the event, e.g.,
 *   `'planner'`, `'chat'`, `'explore'`, `'recipe_detail'`.
 */
export interface AnalyticsEnvelope {
  locale: string;
  appPlatform: 'ios' | 'android' | 'web';
  /**
   * The UI surface that originated the event. `null` only for legacy `logXxx`
   * helpers that pre-date the envelope contract; all new `trackEvent(...)`
   * call-sites must pass a concrete `SourceSurface`.
   */
  sourceSurface: SourceSurface | null;
  /**
   * Beta cohort segment (Strategy 2026-04-25): all funnel metrics must be
   * filterable by cohort. `null` for users not enrolled in the beta; set at
   * beta enrollment via the partner screening question. No DB column yet —
   * flattened into `payload._envelope` with the rest of the envelope until a
   * backfill migration lands.
   */
  cohortSegment: BetaCohort | null;
}

/** Beta cohort segments — Sofía (paid beta) vs Lupita (usability tester only). */
export type BetaCohort = 'sofia' | 'lupita';

/**
 * Envelope fields the caller supplies — `appPlatform` is derived automatically
 * by `eventService.trackEvent(...)` from `Platform.OS`. `cohortSegment` is
 * optional at the call-site; eventService defaults it to `null` when omitted.
 */
export type AnalyticsEnvelopeInput = Omit<AnalyticsEnvelope, 'appPlatform' | 'cohortSegment'> & {
  cohortSegment?: BetaCohort | null;
};

// -----------------------------------------------------------------------------
// Shared enums / literals
// -----------------------------------------------------------------------------

/**
 * Canonical set of UI surfaces that may originate an analytics event.
 *
 * Source of truth: product-kitchen/repeat-what-works/plans/06-analytics-and-metrics.md
 * (see the "common envelope" spec around line 115). If Plan 06 adds a new
 * surface, extend this list — do NOT widen the type to `string`.
 */
export const SOURCE_SURFACES = ['week', 'chat', 'explore', 'profile', 'shopping'] as const;
export type SourceSurface = (typeof SOURCE_SURFACES)[number];

export type ShoppingSyncState = 'not_created' | 'current' | 'stale' | 'error';

export type MealPlanGenerationErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'PLAN_ALREADY_EXISTS'
  | 'INSUFFICIENT_RECIPES'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'LIMITED_CATALOG_COVERAGE';

export type MealPlanSwapErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'SWAP_NOT_AVAILABLE'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED';

export type SkipFallbackType = 'ingredient_reuse' | 'easy_alternative';

export type RatingContext = 'post_cook' | 'recipe_detail';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ExploreSectionId =
  | 'todays_meal'
  | 'for_you'
  | 'your_favourites'
  | 'quick_and_easy'
  | 'worth_a_try'
  | 'popular'
  | 'all_recipes';

export type ChatHomeActionId =
  | 'start_my_week'
  | 'whats_on_my_week'
  | 'what_should_i_cook'
  | 'ingredients_on_hand';

export type ChatHomeActionBehavior = 'navigate' | 'send_message' | 'focus_input';

export type ShoppingListGenerationMode = 'create' | 'replace' | 'refresh';

export type PricingTestResponse = 'yes' | 'no' | 'maybe';

export type FounderSessionType = 'manual' | 'auto';

// -----------------------------------------------------------------------------
// Mi Menú / strategic-metric payloads (Strategy 2026-04-25)
// -----------------------------------------------------------------------------

export interface MiMenuTodayViewedPayload {
  mealPlanId: string | null;
  hasActivePlan: boolean;
  weekStart?: string;
  dayIndex?: number;
}

export interface MiMenuTodayCookTappedPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
  primaryComponentId?: string | null;
  primaryRecipeId?: string | null;
  dayIndex: number;
  mealType: string;
}

export interface MiMenuTodaySwapTappedPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
  dayIndex: number;
  mealType: string;
}

export interface MiMenuWeekViewOpenedPayload {
  mealPlanId: string | null;
  hasActivePlan: boolean;
}

export interface PricingTestResponsePayload {
  priceMxn: number;
  response: PricingTestResponse;
  surveyContext: 'end_of_week_3' | 'manual';
  cohortSegment: BetaCohort | null;
}

export interface BetaCohortAssignedPayload {
  cohortSegment: BetaCohort;
  source: 'enrollment' | 'admin_override';
}

export interface FounderSessionOpenedPayload {
  sessionType: FounderSessionType;
}

// -----------------------------------------------------------------------------
// Planner payloads
// -----------------------------------------------------------------------------

export interface PlannerSetupPayload {
  selectedDayIndexes: number[];
  selectedMealTypes: string[];
  busyDays: number[];
  householdSize: number | null;
  dietaryRestrictionsCount: number;
}

export interface MealPlanGenerationStartedPayload {
  weekStart: string;
  requestedDayIndexes: number[];
  requestedMealTypes: string[];
  isFirstWeekPlan?: boolean;
}

export interface MealPlanGeneratedPayload {
  mealPlanId: string;
  weekStart: string;
  requestedDayIndexes: number[];
  requestedMealTypes: string[];
  generatedSlotCount: number;
  generatedComponentCount: number;
  requestedSlotCount: number;
  isPartial: boolean;
  isFirstWeekPlan?: boolean;
  missingSlotCount: number;
  warningCodes: string[];
  shoppingSyncState: ShoppingSyncState;
  generationDurationMs?: number;
}

export interface MealPlanGenerationFailedPayload {
  weekStart: string;
  requestedDayIndexes: number[];
  requestedMealTypes: string[];
  errorCode: MealPlanGenerationErrorCode;
  generationDurationMs?: number;
}

export interface MealPlanViewedPayload {
  mealPlanId: string;
  weekStart: string;
  sourceSurface?: SourceSurface;
}

export interface MealPlanApprovedPayload {
  mealPlanId: string;
  weekStart: string;
  requestedDayIndexes: number[];
  requestedMealTypes: string[];
  generatedSlotCount: number;
  approvalDurationMs?: number;
  isFirstWeekPlan?: boolean;
  shoppingListId?: string | null;
}

export interface MealPlanMealSwappedPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
  previousPrimaryComponentId?: string | null;
  nextPrimaryComponentId?: string | null;
  dayIndex: number;
  mealType: string;
  previousPrimaryRecipeId: string;
  nextPrimaryRecipeId: string;
  reason?: string;
  shoppingSyncStateAfterSwap: Exclude<ShoppingSyncState, 'current'>;
}

export interface MealPlanSwapFailedPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
  primaryComponentId?: string | null;
  dayIndex: number;
  mealType: string;
  reason?: string;
  errorCode: MealPlanSwapErrorCode;
}

export interface MealPlanSkippedPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
  primaryComponentId?: string | null;
  primaryRecipeId?: string | null;
  dayIndex: number;
  mealType: string;
  skipFallbackType?: SkipFallbackType | null;
  shoppingSyncStateAfterSkip: Exclude<ShoppingSyncState, 'not_created'>;
}

export interface MealPlanSkipSuggestionPayload {
  mealPlanId: string;
  skippedMealPlanSlotId: string;
  affectedMealPlanSlotId?: string | null;
  suggestionType: SkipFallbackType;
  sourceSurface: 'week' | 'chat' | 'notification';
}

// -----------------------------------------------------------------------------
// Shopping payloads
// -----------------------------------------------------------------------------

export interface ShoppingListGenerationStartedPayload {
  mealPlanId: string;
  mode: ShoppingListGenerationMode;
}

export interface ShoppingListFromPlanPayload {
  mealPlanId: string;
  shoppingListId: string;
  generatedItemCount: number;
  planSlotCount: number;
  planComponentCount: number;
  mode: ShoppingListGenerationMode;
  preservedManualItemCount?: number;
  shoppingSyncStateAfter: 'current' | 'error';
}

export interface ShoppingListGenerationFailedPayload {
  mealPlanId: string;
  mode: ShoppingListGenerationMode;
  errorCode: string;
}

export interface ShoppingListOpenedPayload {
  shoppingListId: string;
  source: 'tab' | 'plan_cta' | 'deep_link';
}

export interface ShoppingListRefreshedFromPlanPayload {
  mealPlanId: string;
  shoppingListId: string;
  addedItemCount: number;
  removedItemCount: number;
  preservedManualItemCount: number;
  shoppingSyncStateAfter: 'current' | 'error';
}

// -----------------------------------------------------------------------------
// Cooking / ratings payloads
// -----------------------------------------------------------------------------

export interface PlannedMealCookPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
  primaryComponentId?: string | null;
  primaryRecipeId?: string | null;
  dayIndex: number;
  mealType: string;
  sourceSurface: 'week' | 'chat' | 'explore';
}

export interface RecipeRatedPayload {
  mealPlanId?: string | null;
  mealPlanSlotId?: string | null;
  recipeId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  selectedSentimentTags: string[];
  wouldMakeAgain: boolean | null;
  feedbackTextPresent: boolean;
  isRatingUpdate: boolean;
  ratingContext: RatingContext;
  sourceSurface: 'week' | 'recipe_detail' | 'chat';
}

export interface RecipeDifficultyFlaggedForReviewPayload {
  recipeId: string;
  authoredDifficulty: Difficulty;
  tooDifficultCount: number;
  tooDifficultRate: number;
  ratingCount: number;
}

export interface RecipeDifficultyOverrideAppliedPayload {
  recipeId: string;
  authoredDifficulty: Difficulty;
  communityDifficultyOverride: Difficulty;
  tooDifficultCount: number;
  tooDifficultRate: number;
  ratingCount: number;
}

// -----------------------------------------------------------------------------
// Entry / discovery payloads
// -----------------------------------------------------------------------------

export interface WeekTabViewedPayload {
  hasActivePlan: boolean;
}

export interface ChatHomeActionPayload {
  actionId: ChatHomeActionId;
  actionBehavior: ChatHomeActionBehavior;
  hasActivePlan: boolean;
}

export interface ExploreSectionViewedPayload {
  sectionId: ExploreSectionId;
  sectionPosition: number;
  recipeCountShown: number;
  activeFilterId?: string | null;
}

export interface ExploreRecipeOpenedPayload {
  recipeId: string;
  sectionId: ExploreSectionId | null;
  sectionPosition?: number | null;
  activeFilterId?: string | null;
}

export interface ExploreFilterAppliedPayload {
  filterId: string;
  previousFilterId: string | null;
}

export interface ExploreAddToPlanPayload {
  recipeId: string;
  mealPlanId: string;
  mealPlanSlotId?: string | null;
  sectionId?: ExploreSectionId | null;
}

export interface PlannerSetupLifecyclePayload {
  sourceSurface: SourceSurface;
}

// -----------------------------------------------------------------------------
// Legacy payloads (pre-dating the camelCase convention — keep snake_case)
// -----------------------------------------------------------------------------

export interface LegacyRecipePayload {
  recipe_id: string;
  recipe_name: string;
  recipe_table?: 'recipes' | 'user_recipes';
}

export interface LegacySearchPayload {
  query: string;
}

export interface LegacyRecipeGeneratePayload {
  recipe_name: string;
  success: boolean;
  duration_ms: number;
}

export interface LegacyActionExecutePayload {
  actionType: string;
  source: 'auto' | 'manual';
  path: 'text' | 'voice';
}

// -----------------------------------------------------------------------------
// Event map — discriminated union via keyof lookup
// -----------------------------------------------------------------------------

/**
 * Canonical map of event name -> payload shape.
 *
 * Adding an event: add an entry here. Removing one: remove its entry.
 * Call-sites use `trackEvent(event: AnalyticsEvent, envelopeInput)` where
 * `AnalyticsEvent` is the discriminated union `{ name, payload }` derived from
 * this map, so TypeScript rejects mismatched name/payload pairs at compile time.
 */
export interface EventPayloadMap {
  // --- Legacy events (existing, pre-planner) ---
  view_recipe: LegacyRecipePayload;
  cook_start: LegacyRecipePayload;
  cook_complete: LegacyRecipePayload;
  search: LegacySearchPayload;
  recipe_generate: LegacyRecipeGeneratePayload;
  action_execute: LegacyActionExecutePayload;

  // --- Planner funnel ---
  week_tab_viewed: WeekTabViewedPayload;
  planner_setup_started: PlannerSetupLifecyclePayload;
  planner_setup_completed: PlannerSetupPayload;
  meal_plan_generation_started: MealPlanGenerationStartedPayload;
  meal_plan_generated: MealPlanGeneratedPayload;
  meal_plan_generation_failed: MealPlanGenerationFailedPayload;
  meal_plan_viewed: MealPlanViewedPayload;
  meal_plan_approved: MealPlanApprovedPayload;
  meal_plan_meal_swapped: MealPlanMealSwappedPayload;
  meal_plan_swap_failed: MealPlanSwapFailedPayload;
  meal_plan_skipped: MealPlanSkippedPayload;
  meal_plan_skip_suggestion_shown: MealPlanSkipSuggestionPayload;
  meal_plan_skip_suggestion_accepted: MealPlanSkipSuggestionPayload;
  meal_plan_skip_suggestion_dismissed: MealPlanSkipSuggestionPayload;

  // --- Shopping funnel ---
  shopping_list_generation_started: ShoppingListGenerationStartedPayload;
  shopping_list_generated_from_plan: ShoppingListFromPlanPayload;
  shopping_list_generation_failed: ShoppingListGenerationFailedPayload;
  shopping_list_opened: ShoppingListOpenedPayload;
  shopping_list_refreshed_from_plan: ShoppingListRefreshedFromPlanPayload;

  // --- Cooking / ratings ---
  planned_meal_cook_started: PlannedMealCookPayload;
  planned_meal_cook_completed: PlannedMealCookPayload;
  recipe_rated: RecipeRatedPayload;
  recipe_difficulty_flagged_for_review: RecipeDifficultyFlaggedForReviewPayload;
  recipe_difficulty_override_applied: RecipeDifficultyOverrideAppliedPayload;

  // --- Entry / discovery ---
  chat_home_action_tapped: ChatHomeActionPayload;
  explore_section_viewed: ExploreSectionViewedPayload;
  explore_recipe_opened: ExploreRecipeOpenedPayload;
  explore_filter_applied: ExploreFilterAppliedPayload;
  explore_add_to_plan: ExploreAddToPlanPayload;

  // --- Mi Menú / strategic metrics (Strategy 2026-04-25) ---
  mi_menu_today_viewed: MiMenuTodayViewedPayload;
  mi_menu_today_cook_tapped: MiMenuTodayCookTappedPayload;
  mi_menu_today_swap_tapped: MiMenuTodaySwapTappedPayload;
  mi_menu_week_view_opened: MiMenuWeekViewOpenedPayload;
  pricing_test_response: PricingTestResponsePayload;
  beta_cohort_assigned: BetaCohortAssignedPayload;
  founder_session_opened: FounderSessionOpenedPayload;
}

/** Union of every tracked event name. */
export type EventName = keyof EventPayloadMap;

/** Resolve the payload type for a given event name. */
export type EventPayload<K extends EventName> = EventPayloadMap[K];

/** Discriminated union of { name, payload } pairs — useful for queue rows. */
export type AnalyticsEvent = {
  [K in EventName]: { name: K; payload: EventPayloadMap[K] };
}[EventName];

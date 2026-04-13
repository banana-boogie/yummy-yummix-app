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
 * These types are types-only: they describe what events may be emitted and
 * what payloads they carry. Feature PRs wire up the actual `trackEvent(...)`
 * call-sites.
 */

// -----------------------------------------------------------------------------
// Shared enums / literals
// -----------------------------------------------------------------------------

export type SourceSurface = 'week' | 'chat' | 'explore' | 'profile' | 'shopping';

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
  locale: string;
}

export interface ChatHomeActionPayload {
  actionId: ChatHomeActionId;
  actionBehavior: ChatHomeActionBehavior;
  hasActivePlan: boolean;
  locale: string;
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
 * Call-sites use `trackEvent<K extends EventName>(name: K, payload: EventPayloadMap[K])`,
 * so TypeScript will flag wrong payloads at compile time.
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
}

/** Union of every tracked event name. */
export type EventName = keyof EventPayloadMap;

/** Resolve the payload type for a given event name. */
export type EventPayload<K extends EventName> = EventPayloadMap[K];

/** Discriminated union of { name, payload } pairs — useful for queue rows. */
export type AnalyticsEvent = {
  [K in EventName]: { name: K; payload: EventPayloadMap[K] };
}[EventName];

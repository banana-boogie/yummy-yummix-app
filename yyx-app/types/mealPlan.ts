/**
 * Client types for the meal-planner edge function.
 *
 * These mirror the API contract in
 * yyx-server/supabase/functions/meal-planner/types.ts (slot + component model).
 * Keep in sync when the server contract changes.
 */

export const MEAL_PLAN_ACTIONS = [
  'get_current_plan',
  'generate_plan',
  'swap_meal',
  'skip_meal',
  'mark_meal_cooked',
  'generate_shopping_list',
  'get_preferences',
  'update_preferences',
  'link_shopping_list',
] as const;

export type MealPlanAction = typeof MEAL_PLAN_ACTIONS[number];

export const CANONICAL_MEAL_TYPES = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'beverage',
] as const;
export type CanonicalMealType = typeof CANONICAL_MEAL_TYPES[number];

export const SLOT_TYPES = [
  'cook_slot',
  'leftover_target_slot',
  'no_cook_fallback_slot',
  'weekend_flexible_slot',
] as const;
export type SlotType = typeof SLOT_TYPES[number];

export const STRUCTURE_TEMPLATES = [
  'single_component',
  'main_plus_one_component',
  'main_plus_two_components',
] as const;
export type StructureTemplate = typeof STRUCTURE_TEMPLATES[number];

export const SLOT_STATUSES = ['planned', 'cooked', 'skipped'] as const;
export type SlotStatus = typeof SLOT_STATUSES[number];

export const SHOPPING_SYNC_STATES = [
  'not_created',
  'current',
  'stale',
  'error',
] as const;
export type ShoppingSyncState = typeof SHOPPING_SYNC_STATES[number];

export const COMPONENT_ROLES = [
  'main',
  'side',
  'base',
  'veg',
  'snack',
  'dessert',
  'beverage',
  'condiment',
  'custom',
] as const;
export type ComponentRole = typeof COMPONENT_ROLES[number];

export const SOURCE_KINDS = ['recipe', 'leftover', 'no_cook', 'custom'] as const;
export type SourceKind = typeof SOURCE_KINDS[number];

export const PAIRING_BASES = [
  'standalone',
  'explicit_pairing',
  'role_match',
  'leftover_carry',
  'manual',
] as const;
export type PairingBasis = typeof PAIRING_BASES[number];

export const MEAL_PLAN_STATUSES = ['draft', 'active', 'archived'] as const;
export type MealPlanStatus = typeof MEAL_PLAN_STATUSES[number];

export type MealPlannerErrorCode =
  | 'PLAN_NOT_FOUND'
  | 'PLAN_ALREADY_EXISTS'
  | 'INSUFFICIENT_RECIPES'
  | 'SWAP_NOT_AVAILABLE'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'LIMITED_CATALOG_COVERAGE'
  | 'INTERNAL_ERROR';

export interface MealPlannerErrorResponse {
  error: {
    code: MealPlannerErrorCode;
    message: string;
  };
}

// ============================================================
// Request payloads
// ============================================================

export interface GetCurrentPlanPayload {
  weekStart?: string;
}

export interface GeneratePlanPayload {
  weekStart: string;
  dayIndexes: number[];
  mealTypes: string[];
  busyDays?: number[];
  autoLeftovers?: boolean;
  replaceExisting?: boolean;
}

export interface SwapMealPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
  reason?: string;
  // When omitted, swap_meal is read-only and returns alternatives.
  // When provided, the server applies that recipe to the slot's primary
  // component, increments swap_count, and stamps last_swapped_at.
  selectedRecipeId?: string;
}

export interface SkipMealPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
}

export interface MarkMealCookedPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
}

export interface GenerateShoppingListPayload {
  mealPlanId: string;
}

export interface UpdatePreferencesPayload {
  dayIndexes?: number[];
  mealTypes?: string[];
  busyDays?: number[];
  defaultMaxWeeknightMinutes?: number;
  autoLeftovers?: boolean;
  preferredEatTimes?: Record<string, unknown>;
}

export interface LinkShoppingListPayload {
  mealPlanId: string;
  shoppingListId: string;
}

// ============================================================
// Response shapes
// ============================================================

export interface MealPlanSlotComponentResponse {
  id: string;
  componentRole: ComponentRole;
  sourceKind: SourceKind;
  recipeId: string | null;
  sourceComponentId: string | null;
  foodGroupsSnapshot: string[];
  pairingBasis: PairingBasis;
  displayOrder: number;
  isPrimary: boolean;
  title: string;
  imageUrl: string | null;
  totalTimeMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  portions: number | null;
  equipmentTags: string[];
}

export interface MealPlanSlotResponse {
  id: string;
  plannedDate: string;
  dayIndex: number;
  mealType: CanonicalMealType;
  displayMealLabel: string;
  displayOrder: number;
  slotType: SlotType;
  structureTemplate: StructureTemplate;
  expectedFoodGroups: string[];
  selectionReason: string;
  shoppingSyncState: ShoppingSyncState;
  status: SlotStatus;
  swapCount: number;
  lastSwappedAt: string | null;
  cookedAt: string | null;
  skippedAt: string | null;
  mergedCookingGuide: Record<string, unknown> | null;
  components: MealPlanSlotComponentResponse[];
  // True when the structure_template's expected components are all filled.
  // False signals a partial slot (e.g., main without a side); UI surfaces a
  // hint so the user knows to complete it. Always present; backend defaults
  // to true when the DB row has no coverage signal.
  coverageComplete: boolean;
}

export interface MealPlanResponse {
  planId: string;
  weekStart: string;
  locale: string;
  requestedDayIndexes: number[];
  requestedMealTypes: string[];
  shoppingListId: string | null;
  shoppingSyncState: ShoppingSyncState;
  slots: MealPlanSlotResponse[];
}

export interface MissingSlot {
  dayIndex: number;
  mealType: CanonicalMealType;
}

export interface GetCurrentPlanResponse {
  plan: MealPlanResponse | null;
  warnings: string[];
}

export interface GeneratePlanResponse {
  plan: MealPlanResponse | null;
  isPartial: boolean;
  missingSlots: MissingSlot[];
  warnings: string[];
}

export interface SwapAlternative {
  slot: MealPlanSlotResponse;
  selectionReason: string;
}

export interface SwapMealResponse {
  alternatives: SwapAlternative[];
  warnings: string[];
}

export interface PreferencesResponse {
  mealTypes: CanonicalMealType[];
  busyDays: number[];
  activeDayIndexes: number[];
  defaultMaxWeeknightMinutes: number;
  autoLeftovers: boolean;
  preferredEatTimes: Record<string, unknown>;
  // ISO timestamp set on first successful update_preferences. Null until the
  // user completes the setup flow; the menu screen reads this as the
  // server-side "has the user onboarded?" signal.
  setupCompletedAt: string | null;
}

export interface GetPreferencesResponse {
  preferences: PreferencesResponse;
  warnings: string[];
}

export interface UpdatePreferencesResponse {
  preferences: PreferencesResponse;
  updated: boolean;
  warnings: string[];
}

export interface SkipMealResponse {
  slot: MealPlanSlotResponse | null;
  suggestion: string | null;
  warnings: string[];
}

export interface MarkMealCookedResponse {
  slot: MealPlanSlotResponse | null;
  warnings: string[];
}

export interface GenerateShoppingListResponse {
  shoppingListId: string | null;
  warnings: string[];
}

export interface LinkShoppingListResponse {
  linked: boolean;
  mealPlanId: string | null;
  shoppingListId: string | null;
  warnings: string[];
}

// ============================================================
// Client-only helpers
// ============================================================

export interface PlanProgress {
  planned: number;
  cooked: number;
  skipped: number;
}

export interface GeneratePlanOptions {
  weekStart?: string;
  dayIndexes?: number[];
  mealTypes?: string[];
  busyDays?: number[];
  autoLeftovers?: boolean;
  replaceExisting?: boolean;
}

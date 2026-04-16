/**
 * Meal Planner Types
 *
 * Request/response types for the meal-planner edge function.
 * API contract follows the slot+component model from meal-slot-schema.md § 9.
 */

// ============================================================
// Runtime Constants
// ============================================================

export const MEAL_PLAN_ACTIONS = [
  "get_current_plan",
  "generate_plan",
  "swap_meal",
  "skip_meal",
  "mark_meal_cooked",
  "generate_shopping_list",
  "get_preferences",
  "update_preferences",
  "link_shopping_list",
] as const;

export const CANONICAL_MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "beverage",
] as const;

export const SLOT_TYPES = [
  "cook_slot",
  "leftover_target_slot",
  "no_cook_fallback_slot",
  "weekend_flexible_slot",
] as const;

export const STRUCTURE_TEMPLATES = [
  "single_component",
  "main_plus_one_component",
  "main_plus_two_components",
] as const;

export const SLOT_STATUSES = ["planned", "cooked", "skipped"] as const;

export const SHOPPING_SYNC_STATES = [
  "not_created",
  "current",
  "stale",
  "error",
] as const;

// NOTE: meal-slot-schema.md §3 includes `condiment` while §9 omits it.
// We keep the broader union so the runtime contract can represent valid slot
// components without dropping data.
export const COMPONENT_ROLES = [
  "main",
  "side",
  "base",
  "veg",
  "snack",
  "dessert",
  "beverage",
  "condiment",
  "custom",
] as const;

export const SOURCE_KINDS = [
  "recipe",
  "leftover",
  "no_cook",
  "custom",
] as const;

export const PAIRING_BASES = [
  "standalone",
  "explicit_pairing",
  "role_match",
  "leftover_carry",
  "manual",
] as const;

export const MEAL_PLAN_STATUSES = ["draft", "active", "archived"] as const;

// ============================================================
// Enums / Unions
// ============================================================

export type MealPlanAction = typeof MEAL_PLAN_ACTIONS[number];
export type CanonicalMealType = typeof CANONICAL_MEAL_TYPES[number];
export type SlotType = typeof SLOT_TYPES[number];
export type StructureTemplate = typeof STRUCTURE_TEMPLATES[number];
export type SlotStatus = typeof SLOT_STATUSES[number];
export type ShoppingSyncState = typeof SHOPPING_SYNC_STATES[number];
export type ComponentRole = typeof COMPONENT_ROLES[number];
export type SourceKind = typeof SOURCE_KINDS[number];
export type PairingBasis = typeof PAIRING_BASES[number];
export type MealPlanStatus = typeof MEAL_PLAN_STATUSES[number];

// ============================================================
// Error Codes
// ============================================================

export type MealPlannerErrorCode =
  | "PLAN_NOT_FOUND"
  | "PLAN_ALREADY_EXISTS"
  | "INSUFFICIENT_RECIPES"
  | "SWAP_NOT_AVAILABLE"
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "LIMITED_CATALOG_COVERAGE"
  | "INTERNAL_ERROR";

// ============================================================
// Request Types
// ============================================================

export interface MealPlannerRequest {
  action: MealPlanAction;
  payload?: Record<string, unknown>;
}

export interface GetCurrentPlanPayload {
  weekStart?: string;
}

export interface GeneratePlanPayload {
  weekStart: string;
  dayIndexes: number[];
  mealTypes: string[];
  busyDays?: number[];
  preferLeftoversForLunch?: boolean;
  replaceExisting?: boolean;
}

export interface SwapMealPayload {
  mealPlanId: string;
  mealPlanSlotId: string;
  reason?: string;
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
  preferLeftoversForLunch?: boolean;
  preferredEatTimes?: Record<string, unknown>;
}

export interface LinkShoppingListPayload {
  mealPlanId: string;
  shoppingListId: string;
}

// ============================================================
// Response Types (slot-based, from meal-slot-schema.md § 9)
// ============================================================

export interface MealPlanSlotComponentResponse {
  id: string;
  componentRole: ComponentRole;
  sourceKind: SourceKind;
  recipeId: string | null;
  sourceComponentId: string | null;
  mealComponentsSnapshot: string[];
  pairingBasis: PairingBasis;
  displayOrder: number;
  isPrimary: boolean;
  title: string;
  imageUrl: string | null;
  totalTimeMinutes: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
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
  expectedMealComponents: string[];
  selectionReason: string;
  shoppingSyncState: ShoppingSyncState;
  status: SlotStatus;
  swapCount: number;
  lastSwappedAt: string | null;
  cookedAt: string | null;
  skippedAt: string | null;
  mergedCookingGuide: Record<string, unknown> | null;
  components: MealPlanSlotComponentResponse[];
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
  preferLeftoversForLunch: boolean;
  preferredEatTimes: Record<string, unknown>;
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
// Error Response
// ============================================================

export interface MealPlannerErrorResponse {
  error: {
    code: MealPlannerErrorCode;
    message: string;
  };
}

/**
 * Slot Classifier
 *
 * Converts a (dayIndexes × mealTypes) request into canonical MealSlots.
 * Handles:
 *   - locale → canonical meal-type mapping (comida → lunch, cena → dinner)
 *   - weekend detection (Sat/Sun → weekend_flexible_slot)
 *   - busy-day → leftover_target_slot (downgrades to cook_slot when no valid
 *     source exists in the preceding cookable schedule)
 *   - prefer_leftovers_for_lunch lunch-after-dinner chaining
 *   - dependency-aware planning order
 *
 * Spec: ranking-algorithm-detail.md §1
 */

import type { CanonicalMealType, MealComponent, SlotType } from "./types.ts";
import { STRUCTURE_DEFAULTS, WEEKEND_DAY_INDEXES } from "./scoring-config.ts";
import { toCanonicalMealType } from "./meal-types.ts";

export interface MealSlot {
  slotId: string;
  plannedDate: string;
  dayIndex: number;
  canonicalMealType: CanonicalMealType;
  displayMealLabel: string;
  slotKind: SlotType;
  isBusyDay: boolean;
  isWeekend: boolean;
  prefersLeftovers: boolean;
  feedsFutureLeftoverTarget: boolean;
  sourceDependencySlotId?: string;
  structureTemplate: typeof STRUCTURE_DEFAULTS[CanonicalMealType];
  expectedMealComponents: MealComponent[];
}

export interface SlotClassificationInput {
  weekStart: string; // ISO date (YYYY-MM-DD) for dayIndex 0
  dayIndexes: number[];
  mealTypes: string[]; // raw, may include 'comida'
  busyDays: number[];
  preferLeftoversForLunch: boolean;
  locale: string;
}

export interface SlotClassificationResult {
  slots: MealSlot[]; // in calendar order
  planningOrder: MealSlot[]; // dependency-aware order
}

// Locale-specific display labels for meal types.
// Only include entries that differ from the canonical English word.
const LOCALE_LABELS: Record<
  string,
  Partial<Record<CanonicalMealType, string>>
> = {
  es: {
    breakfast: "desayuno",
    lunch: "comida",
    dinner: "cena",
    snack: "snack",
    dessert: "postre",
    beverage: "bebida",
  },
};

function addDaysIso(startIso: string, daysToAdd: number): string {
  // Interpret startIso as UTC midnight to avoid DST surprises.
  const start = new Date(`${startIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid weekStart: ${startIso}`);
  }
  const next = new Date(start.getTime() + daysToAdd * 86_400_000);
  return next.toISOString().slice(0, 10);
}

function getBaseLanguage(locale: string): string {
  return locale.split("-")[0];
}

function resolveDisplayLabel(
  canonical: CanonicalMealType,
  locale: string,
  rawInput: string,
): string {
  // If the caller passed the locale label already (e.g. "comida"), keep it.
  const trimmed = rawInput.trim().toLowerCase();
  const base = getBaseLanguage(locale);
  const table = LOCALE_LABELS[base];
  if (trimmed === table?.[canonical]) return trimmed;
  return table?.[canonical] ?? canonical;
}

function uniqueSortedDays(days: number[]): number[] {
  return [...new Set(days)].filter((d) =>
    Number.isInteger(d) && d >= 0 && d <= 6
  ).sort((a, b) => a - b);
}

function canonicalMealTypeOrder(mt: CanonicalMealType): number {
  const order: Record<CanonicalMealType, number> = {
    breakfast: 0,
    lunch: 1,
    dinner: 2,
    snack: 3,
    dessert: 4,
    beverage: 5,
  };
  return order[mt];
}

function expectedMealComponentsForTemplate(
  template: typeof STRUCTURE_DEFAULTS[CanonicalMealType],
): MealComponent[] {
  switch (template) {
    case "main_plus_one_component":
    case "main_plus_two_components":
      return ["protein", "carb", "veg"];
    case "single_component":
      return [];
  }
}

/**
 * Classify slots from raw planner input.
 *
 * Algorithm:
 *   1. Build (dayIndex × canonicalMealType) slots in calendar order.
 *   2. Mark weekends → weekend_flexible_slot (unless busy-day overrides).
 *   3. For busy days:
 *        - if a valid previous dinner/lunch cookable slot exists → leftover_target_slot
 *        - otherwise → cook_slot
 *   4. For prefer_leftovers_for_lunch: lunch adjacent to preceding dinner
 *      becomes leftover_target_slot.
 *   5. Emit dependency-aware planning order.
 */
export function classifySlots(
  input: SlotClassificationInput,
): SlotClassificationResult {
  const activeDays = uniqueSortedDays(input.dayIndexes);
  if (activeDays.length === 0) {
    return { slots: [], planningOrder: [] };
  }

  const canonicalMealTypes = [
    ...new Set(input.mealTypes.map((raw) => toCanonicalMealType(raw))),
  ].sort((a, b) => canonicalMealTypeOrder(a) - canonicalMealTypeOrder(b));

  const busySet = new Set(input.busyDays.filter((d) => activeDays.includes(d)));

  // Build raw slots in calendar order.
  const slots: MealSlot[] = [];
  for (const dayIndex of activeDays) {
    for (const canonical of canonicalMealTypes) {
      const rawLabel = input.mealTypes.find(
        (raw) => toCanonicalMealType(raw) === canonical,
      ) ?? canonical;
      const isWeekend = WEEKEND_DAY_INDEXES.has(dayIndex);
      const isBusyDay = busySet.has(dayIndex);

      // Default slot kind: cook_slot; weekend overrides to weekend_flexible_slot.
      let slotKind: SlotType = isWeekend
        ? "weekend_flexible_slot"
        : "cook_slot";

      // Busy days: prefer leftover_target; may downgrade later.
      if (isBusyDay) slotKind = "leftover_target_slot";

      const structureTemplate = STRUCTURE_DEFAULTS[canonical];

      slots.push({
        slotId: `${dayIndex}-${canonical}`,
        plannedDate: addDaysIso(input.weekStart, dayIndex),
        dayIndex,
        canonicalMealType: canonical,
        displayMealLabel: resolveDisplayLabel(
          canonical,
          input.locale,
          rawLabel,
        ),
        slotKind,
        isBusyDay,
        isWeekend,
        prefersLeftovers: isBusyDay ||
          (input.preferLeftoversForLunch && canonical === "lunch"),
        feedsFutureLeftoverTarget: false,
        structureTemplate,
        expectedMealComponents: expectedMealComponentsForTemplate(
          structureTemplate,
        ),
      });
    }
  }

  resolveLeftoverDependencies(slots, input.preferLeftoversForLunch);
  markLeftoverSourceSlots(slots);

  return {
    slots,
    planningOrder: buildPlanningOrder(slots),
  };
}

/**
 * Wire leftover_target_slot dependencies. Pass 1 is calendar order so earlier
 * slots can seed later leftover targets.
 *
 * Valid sources: cook_slot or weekend_flexible_slot for dinner OR lunch
 * scheduled strictly before the target. Breakfasts and snacks are not used
 * as leftover sources.
 *
 * If a busy-day target has no valid source, we revert it to a plain
 * `cook_slot`. The `isBusyDay` flag is still true on the slot so the
 * scoring layer can apply the busy-day bias (easy + fast recipes) without
 * needing a dedicated slot kind. "No-cook fallback" as a concept is
 * deliberately gone — even a sandwich is cooking.
 */
function resolveLeftoverDependencies(
  slots: MealSlot[],
  preferLeftoversForLunch: boolean,
): void {
  for (let i = 0; i < slots.length; i++) {
    const target = slots[i];
    const isLeftoverCandidate = target.slotKind === "leftover_target_slot" ||
      (preferLeftoversForLunch &&
        target.canonicalMealType === "lunch" &&
        !target.isBusyDay &&
        target.slotKind === "cook_slot");

    if (!isLeftoverCandidate) continue;

    const sourceIdx = findPrecedingSourceIndex(slots, i);
    if (sourceIdx === -1) {
      // No valid source — revert to a plain cook_slot. Busy-day bias still
      // applies via `isBusyDay` in the scoring layer.
      if (target.slotKind === "leftover_target_slot") {
        target.slotKind = "cook_slot";
      }
      continue;
    }

    target.slotKind = "leftover_target_slot";
    target.sourceDependencySlotId = slots[sourceIdx].slotId;
  }
}

function markLeftoverSourceSlots(slots: MealSlot[]): void {
  const sourceIds = new Set(
    slots
      .map((slot) => slot.sourceDependencySlotId)
      .filter((slotId): slotId is string => !!slotId),
  );

  for (const slot of slots) {
    slot.feedsFutureLeftoverTarget = sourceIds.has(slot.slotId);
  }
}

function findPrecedingSourceIndex(
  slots: MealSlot[],
  targetIdx: number,
): number {
  const target = slots[targetIdx];
  // Scan backwards in calendar order; only look within the last ~24h window
  // (same-day dinner → next-day lunch, or same-day earlier meal → later meal).
  for (let j = targetIdx - 1; j >= 0; j--) {
    const candidate = slots[j];
    if (candidate.dayIndex < target.dayIndex - 1) break;
    const isSourceKind = candidate.slotKind === "cook_slot" ||
      candidate.slotKind === "weekend_flexible_slot";
    if (!isSourceKind) continue;
    const isSourceMealType = candidate.canonicalMealType === "dinner" ||
      candidate.canonicalMealType === "lunch";
    if (!isSourceMealType) continue;
    return j;
  }
  return -1;
}

/**
 * Planning order:
 *   1. Cook/weekend slots that feed a future leftover target
 *   2. Remaining cook_slot + weekend_flexible_slot
 *   3. leftover_target_slot (needs its source already placed)
 *
 * Within each bucket, preserve calendar order.
 */
export function buildPlanningOrder(slots: MealSlot[]): MealSlot[] {
  const sourcesWithDependents: MealSlot[] = [];
  const otherCookables: MealSlot[] = [];
  const leftoverTargets: MealSlot[] = [];

  for (const slot of slots) {
    if (slot.slotKind === "leftover_target_slot") {
      leftoverTargets.push(slot);
    } else if (slot.feedsFutureLeftoverTarget) {
      sourcesWithDependents.push(slot);
    } else {
      otherCookables.push(slot);
    }
  }

  return [
    ...sourcesWithDependents,
    ...otherCookables,
    ...leftoverTargets,
  ];
}

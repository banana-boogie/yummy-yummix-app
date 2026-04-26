/**
 * Slot Classifier
 *
 * Converts a (dayIndexes × mealTypes) request into canonical MealSlots.
 * Handles:
 *   - locale → canonical meal-type mapping (comida → lunch, cena → dinner)
 *   - weekend detection (Sat/Sun → weekend_flexible_slot)
 *   - busy-day → leftover_target_slot (downgrades to cook_slot when no valid
 *     source exists in the preceding cookable schedule)
 *   - auto_leftovers: when true (default), both lunch AND dinner cook slots
 *     can be satisfied by leftovers from any prior lunch/dinner cook slot
 *     within the existing 24h source window — matches Mexican
 *     comida-recalentado culture
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
  /**
   * When true (default), lunch and dinner cook slots become leftover-target
   * candidates whenever a prior lunch/dinner cook slot exists within the
   * 24h source window. The fallback path (target → cook_slot at runtime
   * when no source produces leftovers) handles "source recipe wasn't
   * leftovers-friendly" automatically.
   */
  autoLeftovers: boolean;
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
 *   4. For autoLeftovers (default true): lunch AND dinner cook slots become
 *      leftover_target candidates whenever a valid prior lunch/dinner source
 *      exists in the 24h window. Sources are claimed at most once.
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
          (input.autoLeftovers &&
            (canonical === "lunch" || canonical === "dinner")),
        feedsFutureLeftoverTarget: false,
        structureTemplate,
        expectedMealComponents: expectedMealComponentsForTemplate(
          structureTemplate,
        ),
      });
    }
  }

  resolveLeftoverDependencies(slots, input.autoLeftovers);
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
  autoLeftovers: boolean,
): void {
  // Track which sources have already been claimed by an earlier target so
  // one source slot doesn't get assigned to two downstream leftover slots.
  // Keyed by source slot index.
  const claimedSources = new Set<number>();

  for (let i = 0; i < slots.length; i++) {
    const target = slots[i];
    // Three paths into "this slot might become a leftover_target_slot":
    //   1. Already classified as leftover_target_slot (busy day)
    //   2. autoLeftovers + lunch/dinner cook slot (the new broader case)
    const isLeftoverCandidate = target.slotKind === "leftover_target_slot" ||
      (autoLeftovers &&
        (target.canonicalMealType === "lunch" ||
          target.canonicalMealType === "dinner") &&
        !target.isBusyDay &&
        target.slotKind === "cook_slot");

    if (!isLeftoverCandidate) continue;

    const sourceIdx = findPrecedingSourceIndex(slots, i, claimedSources);
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
    claimedSources.add(sourceIdx);
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
  claimedSources: Set<number>,
): number {
  const target = slots[targetIdx];
  // Scan backwards in calendar order; only look within the last ~24h window
  // (same-day earlier meal → later meal, or yesterday → today).
  //
  // Important: we accept `leftover_target_slot` as a source candidate too,
  // not just `cook_slot` / `weekend_flexible_slot`. With autoLeftovers chaining
  // lunch→dinner→lunch, a leftover_target slot whose source produces no
  // leftovers will fall back at runtime to a fresh cook recipe — and that
  // fresh recipe's surplus should be available to later slots. The actual
  // inventory check happens in `registerLeftoverSource`, which only stores
  // a source when the slot is recipe-backed with leftoversFriendly + surplus
  // (leftover placeholders have `primary.candidate === null` and exit early).
  // Without this, a chain like 0-lunch (no surplus) → 0-dinner (falls back
  // to 4-portion fresh) → 1-lunch overcooks because the classifier excluded
  // 0-dinner as a source up front.
  for (let j = targetIdx - 1; j >= 0; j--) {
    const candidate = slots[j];
    if (candidate.dayIndex < target.dayIndex - 1) break;
    if (claimedSources.has(j)) continue; // already feeding another leftover slot
    const isSourceKind = candidate.slotKind === "cook_slot" ||
      candidate.slotKind === "weekend_flexible_slot" ||
      candidate.slotKind === "leftover_target_slot";
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

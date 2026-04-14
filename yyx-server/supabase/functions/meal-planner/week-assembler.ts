/**
 * Week Assembler
 *
 * Beam search over planning-ordered slots. At each step we expand the current
 * beam of partial week states by scoring candidates and pushing the top-K
 * successors, then prune back to beam width 5.
 *
 * Partial plans: if no viable candidate exists for a slot, we leave the slot
 * unfilled (cook) or insert a no-cook placeholder (busy-day fallback) and emit
 * a warning. We do NOT pad with low-quality matches.
 *
 * Spec: ranking-algorithm-detail.md §5
 */

import type { MealSlot } from "./slot-classifier.ts";
import type { CandidateMap, RecipeCandidate } from "./candidate-retrieval.ts";
import type { PairingLookup } from "./bundle-builder.ts";
import {
  buildBundle,
  buildLeftoverPlaceholder,
  buildNoCookPlaceholder,
  type SlotComponent,
} from "./bundle-builder.ts";
import { scoreCandidate, violatesHardRules } from "./scoring/index.ts";
import type { UserContext, WeekStateReadOnly } from "./scoring/types.ts";
import { inferProteinKey } from "./scoring/protein-inference.ts";
import {
  ASSEMBLY_ADJUSTMENTS,
  BEAM,
  clamp01,
  LEFTOVER_PLAN_QUALITY,
  LEFTOVER_RESOLUTION_SUBWEIGHTS,
  OPEN_SLOT_CONTRIBUTION,
  RETRIEVAL_LIMITS,
} from "./scoring-config.ts";
import {
  getDayLabel,
  renderSelectionReason,
  type SelectionReasonCode,
} from "./selection-reason-templates.ts";

export interface AssembledSlot {
  slot: MealSlot;
  components: SlotComponent[];
  slotScore: number;
  selectionReason: string;
  contributionScore: number;
  warnings: string[];
}

export interface WeekState {
  assignments: Map<string, AssembledSlot>; // slotId → slot
  assignedRecipeIds: Set<string>;
  assignedProteinByDayIndex: Map<number, string | null>;
  assignedCuisineCounts: Map<string, number>;
  ingredientIdUsage: Map<string, number>;
  leftoverSources: Map<
    string, // slotId of the source
    {
      sourceSlotId: string; // in-memory ref; persistence resolves to DB UUID
      primaryRecipeId: string;
      primaryTitle: string;
      portionsAvailable: number;
      transformRecipeIds: string[];
    }
  >;
  noveltyCount: number;
  mode: "normal" | "first_week_trust";
  slotIndex: number;
  objectiveScore: number; // sum of per-slot contributions + assembly bonuses
  assemblyBonus: number;
  assemblyPenalty: number;
  warnings: string[];
}

export interface AssembleInput {
  slots: MealSlot[]; // calendar order
  planningOrder: MealSlot[];
  candidates: CandidateMap;
  pairings: PairingLookup;
  user: UserContext;
  leftoverTransformByRecipe: Map<string, string[]>;
}

export interface AssembleResult {
  best: WeekState;
  beamCandidates: WeekState[];
  missingSlots: MealSlot[];
}

function cloneState(state: WeekState): WeekState {
  return {
    assignments: new Map(state.assignments),
    assignedRecipeIds: new Set(state.assignedRecipeIds),
    assignedProteinByDayIndex: new Map(state.assignedProteinByDayIndex),
    assignedCuisineCounts: new Map(state.assignedCuisineCounts),
    ingredientIdUsage: new Map(state.ingredientIdUsage),
    leftoverSources: new Map(state.leftoverSources),
    noveltyCount: state.noveltyCount,
    mode: state.mode,
    slotIndex: state.slotIndex,
    objectiveScore: state.objectiveScore,
    assemblyBonus: state.assemblyBonus,
    assemblyPenalty: state.assemblyPenalty,
    warnings: [...state.warnings],
  };
}

function emptyState(mode: WeekState["mode"]): WeekState {
  return {
    assignments: new Map(),
    assignedRecipeIds: new Set(),
    assignedProteinByDayIndex: new Map(),
    assignedCuisineCounts: new Map(),
    ingredientIdUsage: new Map(),
    leftoverSources: new Map(),
    noveltyCount: 0,
    mode,
    slotIndex: 0,
    objectiveScore: 0,
    assemblyBonus: 0,
    assemblyPenalty: 0,
    warnings: [],
  };
}

function readonlyView(state: WeekState): WeekStateReadOnly {
  return {
    assignedRecipeIds: state.assignedRecipeIds,
    assignedProteinByDayIndex: state.assignedProteinByDayIndex,
    assignedCuisineCounts: state.assignedCuisineCounts,
    ingredientIdUsage: state.ingredientIdUsage,
    noveltyCount: state.noveltyCount,
    mode: state.mode,
    slotIndex: state.slotIndex,
  };
}

// Shared helper — see scoring/protein-inference.ts for the canonical marker list.

function recordAssignment(
  state: WeekState,
  slot: MealSlot,
  components: SlotComponent[],
  slotScore: number,
  selectionReason: string,
  contribution: number,
  warnings: string[] = [],
  adjustments: number = 0,
): void {
  state.assignments.set(slot.slotId, {
    slot,
    components,
    slotScore,
    selectionReason,
    contributionScore: contribution,
    warnings,
  });

  for (const comp of components) {
    if (comp.candidate) {
      state.assignedRecipeIds.add(comp.candidate.id);
      for (const id of comp.candidate.ingredientIds) {
        state.ingredientIdUsage.set(
          id,
          (state.ingredientIdUsage.get(id) ?? 0) + 1,
        );
      }
    }
  }

  const primary = components.find((c) => c.isPrimary);
  if (primary?.candidate) {
    const proteinKey = inferProteinKey(primary.candidate);
    if (proteinKey) {
      state.assignedProteinByDayIndex.set(slot.dayIndex, proteinKey);
    }
    for (const tag of primary.candidate.cuisineTags) {
      state.assignedCuisineCounts.set(
        tag,
        (state.assignedCuisineCounts.get(tag) ?? 0) + 1,
      );
    }
  }

  state.slotIndex += 1;
  state.assemblyBonus += Math.max(0, adjustments);
  state.assemblyPenalty += Math.min(0, adjustments);
  state.objectiveScore += contribution + adjustments;
  state.warnings.push(...warnings);
}

function buildSelectionReason(
  slot: MealSlot,
  components: SlotComponent[],
  state: WeekState,
  locale: string,
): string {
  const primary = components.find((c) => c.isPrimary);
  const dayLabel = getDayLabel(slot.dayIndex, locale);

  const code: SelectionReasonCode = resolveReasonCode(slot, primary, state);
  const params = {
    dayLabel,
    sourceTitle: primary?.sourceKind === "leftover"
      ? primary.titleSnapshot
      : undefined,
  };
  return renderSelectionReason(code, locale, params);
}

function resolveReasonCode(
  slot: MealSlot,
  primary: SlotComponent | undefined,
  state: WeekState,
): SelectionReasonCode {
  if (!primary) {
    return slot.slotKind === "no_cook_fallback_slot"
      ? "no_cook_fallback"
      : "default";
  }
  if (primary.sourceKind === "leftover") return "busy_day_leftovers";
  if (primary.sourceKind === "no_cook") return "no_cook_fallback";
  if (state.mode === "first_week_trust") return "first_week_trust";
  if (primary.candidate?.leftoversFriendly && slot.dayIndex <= 3) {
    return "leftovers_source";
  }
  if (primary.candidate?.verifiedAt) return "verified_fit";
  const total = primary.candidate?.totalTimeMinutes ?? 0;
  if (total > 0 && total <= 30) return "time_fit";
  return "default";
}

function registerLeftoverSource(
  state: WeekState,
  slot: MealSlot,
  components: SlotComponent[],
  householdSize: number,
  leftoverTransformByRecipe: Map<string, string[]>,
): void {
  const primary = components.find((c) => c.isPrimary);
  if (!primary?.candidate) return;
  if (!primary.candidate.leftoversFriendly) return;
  const portions = primary.candidate.portions ?? 0;
  const available = Math.max(0, portions - householdSize);
  if (available <= 0) return;
  state.leftoverSources.set(slot.slotId, {
    sourceSlotId: slot.slotId,
    primaryRecipeId: primary.candidate.id,
    primaryTitle: primary.titleSnapshot,
    portionsAvailable: available,
    transformRecipeIds: leftoverTransformByRecipe.get(primary.candidate.id) ??
      [],
  });
}

function leftoverResolutionScore(
  planQuality: number,
  yieldConfidence: number,
  busyDayCoverage: number,
): number {
  return 100 *
    clamp01(
      LEFTOVER_RESOLUTION_SUBWEIGHTS.planQuality * planQuality +
        LEFTOVER_RESOLUTION_SUBWEIGHTS.yieldConfidence * yieldConfidence +
        LEFTOVER_RESOLUTION_SUBWEIGHTS.busyDayCoverage * busyDayCoverage,
    );
}

function expandRecipeCandidates(
  state: WeekState,
  slot: MealSlot,
  candidates: RecipeCandidate[],
  pairings: PairingLookup,
  user: UserContext,
  leftoverTransformByRecipe: Map<string, string[]>,
): WeekState[] {
  const next: WeekState[] = [];
  const readonly = readonlyView(state);
  const scored = candidates
    .map((candidate) => ({
      candidate,
      detail: scoreCandidate({ slot, candidate, state: readonly, user }),
    }))
    .filter((entry) => !violatesHardRules(entry.detail))
    .sort((a, b) => b.detail.total - a.detail.total)
    .slice(0, RETRIEVAL_LIMITS.cookSlotBeamPerState);

  for (const entry of scored) {
    const successor = cloneState(state);
    const components = buildBundle(slot, entry.candidate, pairings);
    const contribution = entry.detail.total;
    const adjustments = assemblyAdjustments(successor, slot, components);
    const reason = buildSelectionReason(
      slot,
      components,
      successor,
      user.locale,
    );
    recordAssignment(
      successor,
      slot,
      components,
      contribution,
      reason,
      contribution,
      [],
      adjustments,
    );
    registerLeftoverSource(
      successor,
      slot,
      components,
      user.householdSize,
      leftoverTransformByRecipe,
    );
    if (
      !user.recentCookedRecipes.has(entry.candidate.id) &&
      !state.assignedRecipeIds.has(entry.candidate.id)
    ) {
      successor.noveltyCount += 1;
    }
    next.push(successor);
  }
  return next;
}

function expandLeftoverTargetSlot(
  state: WeekState,
  slot: MealSlot,
  fallbacks: RecipeCandidate[],
  pairings: PairingLookup,
  user: UserContext,
  leftoverTransformByRecipe: Map<string, string[]>,
): WeekState[] {
  const next: WeekState[] = [];
  const readonly = readonlyView(state);

  const sourceId = slot.sourceDependencySlotId;
  const source = sourceId ? state.leftoverSources.get(sourceId) : undefined;

  if (source) {
    // Prefer explicit leftover_transform if present.
    for (const transformId of source.transformRecipeIds) {
      const transform = pairings.candidatesById.get(transformId);
      if (!transform) continue;
      if (transform.hasAllergenConflict) continue;
      if (transform.hasDislikeConflict) continue;
      const successor = cloneState(state);
      const transformComponent: SlotComponent = {
        role: "main",
        sourceKind: "recipe",
        recipeId: transform.id,
        sourceComponentId: null,
        sourceSlotIdRef: null,
        foodGroupsSnapshot: transform.foodGroups,
        pairingBasis: "explicit_pairing",
        isPrimary: true,
        candidate: transform,
        displayOrder: 0,
        titleSnapshot: transform.title,
        imageSnapshot: transform.imageUrl,
        totalTimeSnapshot: transform.totalTimeMinutes,
        difficultySnapshot: transform.difficulty,
        portionsSnapshot: transform.portions,
        equipmentSnapshot: transform.equipmentTags,
        selectionReason: null,
      };
      const contribution = leftoverResolutionScore(
        LEFTOVER_PLAN_QUALITY.explicitTransform,
        1,
        slot.isBusyDay ? 1 : 0.5,
      );
      const adjustments = slot.isBusyDay
        ? ASSEMBLY_ADJUSTMENTS.busyDayCoveredByLeftovers +
          ASSEMBLY_ADJUSTMENTS.strongLeftoverTransform
        : ASSEMBLY_ADJUSTMENTS.strongLeftoverTransform;
      recordAssignment(
        successor,
        slot,
        [transformComponent],
        contribution,
        buildSelectionReason(
          slot,
          [transformComponent],
          successor,
          user.locale,
        ),
        contribution,
        [],
        adjustments,
      );
      next.push(successor);
    }

    // Always also consider a generic carry-forward leftover.
    const successor = cloneState(state);
    const placeholder = buildLeftoverPlaceholder(
      slot,
      source.sourceSlotId,
      source.primaryTitle,
    );
    const contribution = leftoverResolutionScore(
      LEFTOVER_PLAN_QUALITY.genericCarryForward,
      source.portionsAvailable >= user.householdSize ? 1 : 0.5,
      slot.isBusyDay ? 1 : 0.5,
    );
    const adjustments = slot.isBusyDay
      ? ASSEMBLY_ADJUSTMENTS.busyDayCoveredByLeftovers
      : 0;
    recordAssignment(
      successor,
      slot,
      [placeholder],
      contribution,
      buildSelectionReason(slot, [placeholder], successor, user.locale),
      contribution,
      [],
      adjustments,
    );
    next.push(successor);
    return next;
  }

  // No source available — fall through to no-cook fallback behavior.
  const scoredFallbacks = fallbacks
    .map((candidate) => ({
      candidate,
      detail: scoreCandidate({
        slot: { ...slot, slotKind: "no_cook_fallback_slot" },
        candidate,
        state: readonly,
        user,
      }),
    }))
    .filter((entry) => !violatesHardRules(entry.detail))
    .sort((a, b) => b.detail.total - a.detail.total)
    .slice(0, RETRIEVAL_LIMITS.fallbackBeamPerState);

  for (const entry of scoredFallbacks) {
    const successor = cloneState(state);
    const components = buildBundle(slot, entry.candidate, pairings);
    successor.warnings.push(
      `FALLBACK_WITHOUT_LEFTOVER_SOURCE:${slot.slotId}`,
    );
    const contribution = entry.detail.total;
    recordAssignment(
      successor,
      slot,
      components,
      contribution,
      buildSelectionReason(slot, components, successor, user.locale),
      contribution,
      [],
      ASSEMBLY_ADJUSTMENTS.fallbackWhenLeftoverShouldHaveExisted,
    );
    registerLeftoverSource(
      successor,
      slot,
      components,
      user.householdSize,
      leftoverTransformByRecipe,
    );
    next.push(successor);
  }

  if (next.length === 0) {
    // Last resort — empty no-cook placeholder with open contribution.
    const successor = cloneState(state);
    const placeholder = buildNoCookPlaceholder(slot, user.locale);
    recordAssignment(
      successor,
      slot,
      [placeholder],
      OPEN_SLOT_CONTRIBUTION.openNoCook,
      buildSelectionReason(slot, [placeholder], successor, user.locale),
      OPEN_SLOT_CONTRIBUTION.openNoCook,
      [`UNFILLED_LEFTOVER_TARGET:${slot.slotId}`],
      ASSEMBLY_ADJUSTMENTS.fallbackWhenLeftoverShouldHaveExisted,
    );
    next.push(successor);
  }

  return next;
}

function expandNoCookFallback(
  state: WeekState,
  slot: MealSlot,
  fallbacks: RecipeCandidate[],
  pairings: PairingLookup,
  user: UserContext,
): WeekState[] {
  const next: WeekState[] = [];
  const readonly = readonlyView(state);
  const scored = fallbacks
    .map((candidate) => ({
      candidate,
      detail: scoreCandidate({ slot, candidate, state: readonly, user }),
    }))
    .filter((entry) => !violatesHardRules(entry.detail))
    .sort((a, b) => b.detail.total - a.detail.total)
    .slice(0, RETRIEVAL_LIMITS.fallbackBeamPerState);

  for (const entry of scored) {
    const successor = cloneState(state);
    const components = buildBundle(slot, entry.candidate, pairings);
    const contribution = entry.detail.total;
    recordAssignment(
      successor,
      slot,
      components,
      contribution,
      buildSelectionReason(slot, components, successor, user.locale),
      contribution,
      [],
      0,
    );
    next.push(successor);
  }

  // Always offer the no-cook placeholder as an alternative successor. Beam
  // selection picks whichever scores higher. Without this, a scored recipe
  // would always win in `no_cook_fallback_slot` since the placeholder used
  // to only be emitted when `scored` was empty — which silently scheduled
  // cooking in slots the user flagged as busy. The placeholder contribution
  // is `OPEN_SLOT_CONTRIBUTION.openNoCook` (55), so a recipe only wins when
  // its total score genuinely exceeds that floor.
  const placeholderSuccessor = cloneState(state);
  const placeholder = buildNoCookPlaceholder(slot, user.locale);
  recordAssignment(
    placeholderSuccessor,
    slot,
    [placeholder],
    OPEN_SLOT_CONTRIBUTION.openNoCook,
    buildSelectionReason(
      slot,
      [placeholder],
      placeholderSuccessor,
      user.locale,
    ),
    OPEN_SLOT_CONTRIBUTION.openNoCook,
    scored.length === 0 ? [`OPEN_NO_COOK_SLOT:${slot.slotId}`] : [],
    0,
  );
  next.push(placeholderSuccessor);

  return next;
}

function assemblyAdjustments(
  state: WeekState,
  slot: MealSlot,
  components: SlotComponent[],
): number {
  let adjustments = 0;

  const primary = components.find((c) => c.isPrimary);
  if (!primary?.candidate) return 0;

  // Adjacent same-protein repeat.
  const proteinKey = inferProteinKey(primary.candidate);
  if (proteinKey) {
    if (
      state.assignedProteinByDayIndex.get(slot.dayIndex - 1) === proteinKey ||
      state.assignedProteinByDayIndex.get(slot.dayIndex + 1) === proteinKey
    ) {
      adjustments += ASSEMBLY_ADJUSTMENTS.adjacentSameProteinRepeat;
    }
  }

  // Cuisine repeated too often.
  if (primary.candidate.cuisineTags.length > 0) {
    const tag = primary.candidate.cuisineTags[0];
    const count = state.assignedCuisineCounts.get(tag) ?? 0;
    if (count >= 2) adjustments += ASSEMBLY_ADJUSTMENTS.cuisineRepeatedTooOften;
  }

  // Novelty penalty in first-week mode.
  if (
    state.mode === "first_week_trust" &&
    state.noveltyCount >= 1
  ) {
    adjustments += ASSEMBLY_ADJUSTMENTS.extraNoveltyFirstWeek;
  }

  // Family-flexible bonus for large households.
  if (state.assignedRecipeIds.size === 0 && primary.candidate.isComplete) {
    // leave neutral — don't double count
  }

  return adjustments;
}

/**
 * Main entry point: run beam search in planning-order, return best terminal
 * state and list of unfilled/missing slots.
 */
export function assembleWeek(input: AssembleInput): AssembleResult {
  const mode: WeekState["mode"] = input.user.evidenceWeeks === 0
    ? "first_week_trust"
    : "normal";

  let beam: WeekState[] = [emptyState(mode)];

  for (const slot of input.planningOrder) {
    const nextBeam: WeekState[] = [];
    for (const state of beam) {
      let successors: WeekState[] = [];
      const cookCandidates = input.candidates.cook.get(slot.slotId) ?? [];
      const fallbackCandidates = input.candidates.fallback.get(slot.slotId) ??
        [];

      if (slot.slotKind === "leftover_target_slot") {
        successors = expandLeftoverTargetSlot(
          state,
          slot,
          fallbackCandidates.length ? fallbackCandidates : cookCandidates,
          input.pairings,
          input.user,
          input.leftoverTransformByRecipe,
        );
      } else if (slot.slotKind === "no_cook_fallback_slot") {
        successors = expandNoCookFallback(
          state,
          slot,
          fallbackCandidates.length ? fallbackCandidates : cookCandidates,
          input.pairings,
          input.user,
        );
      } else {
        successors = expandRecipeCandidates(
          state,
          slot,
          cookCandidates,
          input.pairings,
          input.user,
          input.leftoverTransformByRecipe,
        );
        if (successors.length === 0) {
          // Unable to fill a cook slot: keep a partial state and emit warning.
          const successor = cloneState(state);
          successor.warnings.push(`UNFILLED_COOK_SLOT:${slot.slotId}`);
          successor.assemblyPenalty += ASSEMBLY_ADJUSTMENTS.unfilledNonBusySlot;
          successor.objectiveScore += ASSEMBLY_ADJUSTMENTS.unfilledNonBusySlot;
          successor.slotIndex += 1;
          successors = [successor];
        }
      }

      nextBeam.push(...successors);
    }

    beam = nextBeam.length
      ? nextBeam
        .slice()
        .sort((a, b) => b.objectiveScore - a.objectiveScore)
        .slice(0, BEAM.width)
      : beam;
  }

  const best = beam.reduce(
    (acc, s) => (s.objectiveScore > acc.objectiveScore ? s : acc),
    beam[0] ?? emptyState(mode),
  );

  const missingSlots = input.slots.filter(
    (s) => !best.assignments.has(s.slotId),
  );

  return { best, beamCandidates: beam, missingSlots };
}

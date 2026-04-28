import {
  mealTypeForHour,
  selectPrimarySlot,
} from '@/components/planner/utils/selectPrimarySlot';
import type {
  CanonicalMealType,
  MealPlanSlotResponse,
  PreferencesResponse,
  SlotStatus,
} from '@/types/mealPlan';

function buildSlot(
  overrides: Partial<MealPlanSlotResponse> & {
    id: string;
    mealType: CanonicalMealType;
  },
): MealPlanSlotResponse {
  return {
    plannedDate: '2026-04-25',
    dayIndex: 5,
    displayMealLabel: overrides.mealType,
    displayOrder: 0,
    slotType: 'cook_slot',
    structureTemplate: 'single_component',
    expectedFoodGroups: [],
    selectionReason: '',
    shoppingSyncState: 'not_created',
    status: 'planned' as SlotStatus,
    swapCount: 0,
    lastSwappedAt: null,
    cookedAt: null,
    skippedAt: null,
    mergedCookingGuide: null,
    components: [],
    ...overrides,
  };
}

function buildPreferences(
  overrides: Partial<PreferencesResponse> = {},
): PreferencesResponse {
  return {
    mealTypes: [],
    busyDays: [],
    activeDayIndexes: [0, 1, 2, 3, 4],
    defaultMaxWeeknightMinutes: 30,
    preferLeftoversForLunch: false,
    preferredEatTimes: {},
    ...overrides,
  };
}

describe('mealTypeForHour', () => {
  it('returns breakfast before 11', () => {
    expect(mealTypeForHour(7, 'es-MX')).toBe('breakfast');
    expect(mealTypeForHour(10, 'en-US')).toBe('breakfast');
  });

  it('returns lunch between 11 and 16/17', () => {
    expect(mealTypeForHour(11, 'es-MX')).toBe('lunch');
    expect(mealTypeForHour(15, 'en-US')).toBe('lunch');
  });

  it('crosses to dinner at 16:00 for en, 17:00 for es', () => {
    // 16:59 — en already in dinner, es still in lunch.
    expect(mealTypeForHour(16, 'en-US')).toBe('dinner');
    expect(mealTypeForHour(16, 'es-MX')).toBe('lunch');
    // 17:00 — both in dinner.
    expect(mealTypeForHour(17, 'es-MX')).toBe('dinner');
    expect(mealTypeForHour(17, 'en-US')).toBe('dinner');
  });
});

describe('selectPrimarySlot', () => {
  const noon = new Date('2026-04-25T12:00:00');

  it('returns null for empty list', () => {
    expect(selectPrimarySlot([], null, 'es-MX', noon)).toBeNull();
  });

  it('step 1: picks the time-of-day match', () => {
    const slots = [
      buildSlot({ id: 'b', mealType: 'breakfast' }),
      buildSlot({ id: 'l', mealType: 'lunch' }),
      buildSlot({ id: 'd', mealType: 'dinner' }),
    ];
    // noon → lunch
    expect(selectPrimarySlot(slots, null, 'es-MX', noon)?.id).toBe('l');
  });

  it('step 1 boundary: 16:59 in es prefers lunch, in en prefers dinner', () => {
    const slots = [
      buildSlot({ id: 'l', mealType: 'lunch' }),
      buildSlot({ id: 'd', mealType: 'dinner' }),
    ];
    const t = new Date('2026-04-25T16:59:00');
    expect(selectPrimarySlot(slots, null, 'es-MX', t)?.id).toBe('l');
    expect(selectPrimarySlot(slots, null, 'en-US', t)?.id).toBe('d');
  });

  it('step 1 boundary: 17:00 picks dinner in both locales', () => {
    const slots = [
      buildSlot({ id: 'l', mealType: 'lunch' }),
      buildSlot({ id: 'd', mealType: 'dinner' }),
    ];
    const t = new Date('2026-04-25T17:00:00');
    expect(selectPrimarySlot(slots, null, 'es-MX', t)?.id).toBe('d');
    expect(selectPrimarySlot(slots, null, 'en-US', t)?.id).toBe('d');
  });

  it('step 2: falls back to user-preferred meal type when time match is cooked', () => {
    const slots = [
      buildSlot({ id: 'l', mealType: 'lunch', status: 'cooked' }),
      buildSlot({ id: 'b', mealType: 'breakfast' }),
      buildSlot({ id: 'd', mealType: 'dinner' }),
    ];
    const prefs = buildPreferences({ mealTypes: ['dinner', 'breakfast'] });
    expect(selectPrimarySlot(slots, prefs, 'es-MX', noon)?.id).toBe('d');
  });

  it('step 3: falls back to locale default when no user prefs match', () => {
    const slots = [
      // No lunch slot, breakfast already cooked, dinner exists.
      buildSlot({ id: 'b', mealType: 'breakfast', status: 'cooked' }),
      buildSlot({ id: 'd', mealType: 'dinner' }),
    ];
    // 12:00 lunch preferred, no lunch → no user prefs → en default = dinner.
    expect(selectPrimarySlot(slots, null, 'en-US', noon)?.id).toBe('d');
  });

  it('step 4: returns any uncooked when locale default also missing', () => {
    const slots = [
      buildSlot({ id: 's', mealType: 'snack' }),
      buildSlot({ id: 'b', mealType: 'breakfast', status: 'cooked' }),
    ];
    // Lunch preferred, no lunch / dinner / locale-default → snack.
    expect(selectPrimarySlot(slots, null, 'en-US', noon)?.id).toBe('s');
  });

  it('step 5: everything cooked → returns latest cooked by displayOrder', () => {
    const slots = [
      buildSlot({
        id: 'b',
        mealType: 'breakfast',
        status: 'cooked',
        displayOrder: 0,
      }),
      buildSlot({
        id: 'l',
        mealType: 'lunch',
        status: 'cooked',
        displayOrder: 1,
      }),
      buildSlot({
        id: 'd',
        mealType: 'dinner',
        status: 'cooked',
        displayOrder: 2,
      }),
    ];
    expect(selectPrimarySlot(slots, null, 'es-MX', noon)?.id).toBe('d');
  });

  it('multi-meal day at lunch picks lunch even if dinner exists', () => {
    const slots = [
      buildSlot({ id: 'l', mealType: 'lunch' }),
      buildSlot({ id: 'd', mealType: 'dinner' }),
    ];
    expect(selectPrimarySlot(slots, null, 'es-MX', noon)?.id).toBe('l');
  });

  it('skipped slots are not skipped by step 1 (cooked-only filter)', () => {
    // Step 1 only skips cooked slots; a skipped slot can still match.
    const slots = [
      buildSlot({ id: 'l', mealType: 'lunch', status: 'skipped' }),
      buildSlot({ id: 'd', mealType: 'dinner' }),
    ];
    expect(selectPrimarySlot(slots, null, 'es-MX', noon)?.id).toBe('l');
  });
});

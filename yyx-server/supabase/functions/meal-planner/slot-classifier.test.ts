import {
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifySlots } from "./slot-classifier.ts";

Deno.test("classifySlots: weekday cook slots have cook_slot kind", () => {
  const result = classifySlots({
    weekStart: "2026-04-13", // Monday
    dayIndexes: [0, 1, 2],
    mealTypes: ["dinner"],
    busyDays: [],
    autoLeftovers: false,
    locale: "en",
  });
  assertEquals(result.slots.length, 3);
  for (const s of result.slots) {
    assertEquals(s.slotKind, "cook_slot");
    assertEquals(s.canonicalMealType, "dinner");
    assertEquals(s.isBusyDay, false);
    assertEquals(s.isWeekend, false);
    assertEquals(s.feedsFutureLeftoverTarget, false);
  }
});

Deno.test("classifySlots: comida maps to lunch but displays as comida for es", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0],
    mealTypes: ["comida"],
    busyDays: [],
    autoLeftovers: false,
    locale: "es",
  });
  assertEquals(result.slots.length, 1);
  assertEquals(result.slots[0].canonicalMealType, "lunch");
  assertEquals(result.slots[0].displayMealLabel, "comida");
});

Deno.test("classifySlots: expected meal components reflect slot requirement", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0],
    mealTypes: ["dinner", "snack"],
    busyDays: [],
    autoLeftovers: false,
    locale: "en",
  });
  const dinner = result.slots.find((s) => s.canonicalMealType === "dinner");
  const snack = result.slots.find((s) => s.canonicalMealType === "snack");

  assertEquals(dinner?.structureTemplate, "main_plus_one_component");
  assertEquals(dinner?.expectedMealComponents, ["protein", "carb", "veg"]);
  assertEquals(snack?.structureTemplate, "single_component");
  assertEquals(snack?.expectedMealComponents, []);
});

Deno.test("classifySlots: weekend days produce weekend_flexible_slot", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [4, 5, 6],
    mealTypes: ["dinner"],
    busyDays: [],
    autoLeftovers: false,
    locale: "en",
  });
  assertEquals(result.slots[0].slotKind, "cook_slot");
  assertEquals(result.slots[1].slotKind, "weekend_flexible_slot");
  assertEquals(result.slots[2].slotKind, "weekend_flexible_slot");
});

Deno.test("classifySlots: busy day with valid prior source becomes leftover_target_slot", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0, 1],
    mealTypes: ["dinner"],
    busyDays: [1],
    autoLeftovers: false,
    locale: "en",
  });
  assertEquals(result.slots.length, 2);
  assertEquals(result.slots[0].slotKind, "cook_slot");
  assertEquals(result.slots[1].slotKind, "leftover_target_slot");
  assertEquals(result.slots[0].feedsFutureLeftoverTarget, true);
  assertEquals(result.slots[1].feedsFutureLeftoverTarget, false);
  assertStrictEquals(
    result.slots[1].sourceDependencySlotId,
    result.slots[0].slotId,
  );
});

Deno.test("classifySlots: busy day without prior source reverts to cook_slot (isBusyDay preserved)", () => {
  // The no_cook_fallback_slot concept was removed. Busy days without a valid
  // prior source become plain cook_slots; the scoring layer reads `isBusyDay`
  // and applies the easy+fast bias. Users always get a real recipe, never a
  // "no-cook meal" placeholder.
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0],
    mealTypes: ["dinner"],
    busyDays: [0],
    autoLeftovers: false,
    locale: "en",
  });
  assertEquals(result.slots[0].slotKind, "cook_slot");
  assertEquals(result.slots[0].isBusyDay, true);
});

Deno.test("classifySlots: autoLeftovers=true makes same-day dinner a leftover_target sourced from same-day lunch (comida → cena recalentado)", () => {
  // The classic Mexican comida → cena pattern: comida (lunch) is the main
  // hot meal, cena (dinner) is recalentado from comida the same day.
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0],
    mealTypes: ["lunch", "dinner"],
    busyDays: [],
    autoLeftovers: true,
    locale: "es-MX",
  });

  const d0lunch = result.slots.find(
    (s) => s.dayIndex === 0 && s.canonicalMealType === "lunch",
  );
  const d0dinner = result.slots.find(
    (s) => s.dayIndex === 0 && s.canonicalMealType === "dinner",
  );

  // Lunch is the source (no prior slot to source from).
  assertEquals(d0lunch?.slotKind, "cook_slot");
  // Dinner becomes the leftover_target sourced from the same-day lunch.
  assertEquals(d0dinner?.slotKind, "leftover_target_slot");
  assertEquals(d0dinner?.sourceDependencySlotId, d0lunch?.slotId);
  assertEquals(d0lunch?.feedsFutureLeftoverTarget, true);
});

Deno.test("classifySlots: autoLeftovers=true claims each source at most once", () => {
  // Day 0: lunch + dinner (lunch sources dinner, claim 0-lunch).
  // Day 1: lunch + dinner (1-lunch is fresh source for 1-dinner).
  // 0-lunch should not also be claimed as 1-lunch's source — it's a day older
  // AND already claimed.
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0, 1],
    mealTypes: ["lunch", "dinner"],
    busyDays: [],
    autoLeftovers: true,
    locale: "en",
  });

  const counts = result.slots.reduce(
    (acc, s) => {
      acc[s.slotKind] = (acc[s.slotKind] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  // 2 cook (the two lunches that are sources) + 2 leftover_target (the two dinners).
  assertEquals(counts.cook_slot, 2);
  assertEquals(counts.leftover_target_slot, 2);

  const d0dinner = result.slots.find(
    (s) => s.dayIndex === 0 && s.canonicalMealType === "dinner",
  );
  const d1dinner = result.slots.find(
    (s) => s.dayIndex === 1 && s.canonicalMealType === "dinner",
  );
  const d0lunch = result.slots.find(
    (s) => s.dayIndex === 0 && s.canonicalMealType === "lunch",
  );
  const d1lunch = result.slots.find(
    (s) => s.dayIndex === 1 && s.canonicalMealType === "lunch",
  );
  assertEquals(d0dinner?.sourceDependencySlotId, d0lunch?.slotId);
  assertEquals(d1dinner?.sourceDependencySlotId, d1lunch?.slotId);
});

Deno.test("classifySlots: autoLeftovers=false leaves all non-busy slots as cook_slot", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0, 1],
    mealTypes: ["lunch", "dinner"],
    busyDays: [],
    autoLeftovers: false,
    locale: "en",
  });
  for (const slot of result.slots) {
    assertEquals(slot.slotKind, "cook_slot");
  }
});

Deno.test("classifySlots: autoLeftovers=true does NOT make breakfast a leftover_target", () => {
  // Breakfast / snack / dessert / beverage are excluded from leftover-target
  // eligibility — only lunch and dinner cook slots can be targets.
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0, 1],
    mealTypes: ["breakfast", "dinner"],
    busyDays: [],
    autoLeftovers: true,
    locale: "en",
  });
  const d1breakfast = result.slots.find(
    (s) => s.dayIndex === 1 && s.canonicalMealType === "breakfast",
  );
  // Even though day 0 dinner exists as a potential source, day 1 breakfast
  // is not a leftover candidate.
  assertEquals(d1breakfast?.slotKind, "cook_slot");
});

Deno.test("classifySlots: planning order puts sources first, leftover targets last", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0, 1, 5],
    mealTypes: ["dinner"],
    busyDays: [1],
    autoLeftovers: false,
    locale: "en",
  });
  // day 0 cook_slot (source for day 1), day 5 weekend, day 1 leftover_target
  const kinds = result.planningOrder.map((s) => s.slotKind);
  assertEquals(kinds[0], "cook_slot"); // source
  assertEquals(kinds[kinds.length - 1], "leftover_target_slot");
});

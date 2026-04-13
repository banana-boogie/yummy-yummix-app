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
    preferLeftoversForLunch: false,
    locale: "en",
  });
  assertEquals(result.slots.length, 3);
  for (const s of result.slots) {
    assertEquals(s.slotKind, "cook_slot");
    assertEquals(s.canonicalMealType, "dinner");
    assertEquals(s.isBusyDay, false);
    assertEquals(s.isWeekend, false);
  }
});

Deno.test("classifySlots: comida maps to lunch but displays as comida for es", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0],
    mealTypes: ["comida"],
    busyDays: [],
    preferLeftoversForLunch: false,
    locale: "es",
  });
  assertEquals(result.slots.length, 1);
  assertEquals(result.slots[0].canonicalMealType, "lunch");
  assertEquals(result.slots[0].displayMealLabel, "comida");
});

Deno.test("classifySlots: weekend days produce weekend_flexible_slot", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [4, 5, 6],
    mealTypes: ["dinner"],
    busyDays: [],
    preferLeftoversForLunch: false,
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
    preferLeftoversForLunch: false,
    locale: "en",
  });
  assertEquals(result.slots.length, 2);
  assertEquals(result.slots[0].slotKind, "cook_slot");
  assertEquals(result.slots[1].slotKind, "leftover_target_slot");
  assertStrictEquals(
    result.slots[1].sourceDependencySlotId,
    result.slots[0].slotId,
  );
});

Deno.test("classifySlots: busy day without prior source downgrades to no_cook_fallback_slot", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0],
    mealTypes: ["dinner"],
    busyDays: [0],
    preferLeftoversForLunch: false,
    locale: "en",
  });
  assertEquals(result.slots[0].slotKind, "no_cook_fallback_slot");
});

Deno.test("classifySlots: prefer_leftovers_for_lunch turns lunch after dinner into leftover_target_slot", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0, 1],
    mealTypes: ["dinner", "lunch"],
    busyDays: [],
    preferLeftoversForLunch: true,
    locale: "en",
  });
  // Order returned is sorted by meal-type priority: lunch before dinner per day.
  // Day 0 lunch has no prior source, so it stays as cook_slot.
  // Day 1 lunch has day 0 dinner as source → leftover_target.
  const d1lunch = result.slots.find(
    (s) => s.dayIndex === 1 && s.canonicalMealType === "lunch",
  );
  const d0dinner = result.slots.find(
    (s) => s.dayIndex === 0 && s.canonicalMealType === "dinner",
  );
  assertEquals(d1lunch?.slotKind, "leftover_target_slot");
  assertEquals(d1lunch?.sourceDependencySlotId, d0dinner?.slotId);
});

Deno.test("classifySlots: planning order puts sources first, leftover targets after cookables, fallbacks last", () => {
  const result = classifySlots({
    weekStart: "2026-04-13",
    dayIndexes: [0, 1, 5],
    mealTypes: ["dinner"],
    busyDays: [1],
    preferLeftoversForLunch: false,
    locale: "en",
  });
  // day 0 cook_slot (source for day 1), day 5 weekend, day 1 leftover_target
  const kinds = result.planningOrder.map((s) => s.slotKind);
  assertEquals(kinds[0], "cook_slot"); // source
  assertEquals(kinds[kinds.length - 1], "leftover_target_slot");
});

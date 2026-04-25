import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { toCanonicalMealType } from "./meal-types.ts";

Deno.test("toCanonicalMealType maps Spanish labels to canonical types", () => {
  assertEquals(toCanonicalMealType("comida"), "lunch");
  assertEquals(toCanonicalMealType("cena"), "dinner");
  assertEquals(toCanonicalMealType("desayuno"), "breakfast");
  assertEquals(toCanonicalMealType("botana"), "snack");
});

Deno.test("toCanonicalMealType passes canonical types through", () => {
  assertEquals(toCanonicalMealType("breakfast"), "breakfast");
  assertEquals(toCanonicalMealType("lunch"), "lunch");
  assertEquals(toCanonicalMealType("dinner"), "dinner");
  assertEquals(toCanonicalMealType("snack"), "snack");
  assertEquals(toCanonicalMealType("dessert"), "dessert");
  assertEquals(toCanonicalMealType("beverage"), "beverage");
});

Deno.test("toCanonicalMealType maps bebida to beverage", () => {
  assertEquals(toCanonicalMealType("bebida"), "beverage");
  assertEquals(toCanonicalMealType("BEBIDA"), "beverage");
});

Deno.test("toCanonicalMealType is case-insensitive", () => {
  assertEquals(toCanonicalMealType("COMIDA"), "lunch");
  assertEquals(toCanonicalMealType("Dinner"), "dinner");
});

Deno.test("toCanonicalMealType throws on unknown labels", () => {
  assertThrows(() => toCanonicalMealType("brunch"), Error, "Unknown meal type");
  assertThrows(() => toCanonicalMealType(""), Error, "Unknown meal type");
});

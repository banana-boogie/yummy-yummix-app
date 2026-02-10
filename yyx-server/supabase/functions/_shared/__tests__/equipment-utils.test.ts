/**
 * Equipment Utilities Tests
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { hasThermomix } from "../equipment-utils.ts";

Deno.test("hasThermomix - returns true for Thermomix", () => {
  assertEquals(hasThermomix(["Thermomix", "Oven"]), true);
});

Deno.test("hasThermomix - case insensitive", () => {
  assertEquals(hasThermomix(["thermomix TM6"]), true);
  assertEquals(hasThermomix(["THERMOMIX"]), true);
});

Deno.test("hasThermomix - returns false when absent", () => {
  assertEquals(hasThermomix(["Oven", "Blender"]), false);
});

Deno.test("hasThermomix - returns false for empty array", () => {
  assertEquals(hasThermomix([]), false);
});

Deno.test("hasThermomix - partial match works", () => {
  assertEquals(hasThermomix(["My Thermomix TM6"]), true);
});

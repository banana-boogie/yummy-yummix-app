/**
 * Equipment Utilities Tests
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { getThermomixModel, hasThermomix } from "../equipment-utils.ts";

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

// --- getThermomixModel ---

Deno.test("getThermomixModel - extracts TM6 from underscore format", () => {
  assertEquals(getThermomixModel(["thermomix_TM6"]), "TM6");
});

Deno.test("getThermomixModel - extracts TM7 from space format", () => {
  assertEquals(getThermomixModel(["Thermomix TM7"]), "TM7");
});

Deno.test("getThermomixModel - extracts TM5 case-insensitive", () => {
  assertEquals(getThermomixModel(["thermomix_tm5"]), "TM5");
});

Deno.test("getThermomixModel - returns null when no model suffix", () => {
  assertEquals(getThermomixModel(["Thermomix"]), null);
});

Deno.test("getThermomixModel - returns null for empty array", () => {
  assertEquals(getThermomixModel([]), null);
});

Deno.test("getThermomixModel - returns null for non-Thermomix equipment", () => {
  assertEquals(getThermomixModel(["Oven", "Blender"]), null);
});

Deno.test("getThermomixModel - picks first Thermomix if multiple present", () => {
  assertEquals(getThermomixModel(["thermomix_TM5", "thermomix_TM7"]), "TM5");
});

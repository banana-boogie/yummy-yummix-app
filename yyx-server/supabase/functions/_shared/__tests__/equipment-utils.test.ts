/**
 * Equipment Utilities Tests
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  getThermomixModel,
  getThermomixModels,
  hasThermomix,
} from "../equipment-utils.ts";

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

Deno.test("getThermomixModel - picks newest model when multiple present", () => {
  assertEquals(getThermomixModel(["thermomix_TM5", "thermomix_TM7"]), "TM7");
});

// --- getThermomixModels ---

Deno.test("getThermomixModels - returns all models sorted newest-first", () => {
  assertEquals(
    getThermomixModels(["thermomix_TM5", "thermomix_TM6", "thermomix_TM7"]),
    ["TM7", "TM6", "TM5"],
  );
});

Deno.test("getThermomixModels - returns single model in array", () => {
  assertEquals(getThermomixModels(["thermomix_TM6"]), ["TM6"]);
});

Deno.test("getThermomixModels - returns empty array when no models", () => {
  assertEquals(getThermomixModels(["Oven", "Blender"]), []);
});

Deno.test("getThermomixModels - returns empty array for empty input", () => {
  assertEquals(getThermomixModels([]), []);
});

Deno.test("getThermomixModels - deduplicates models", () => {
  assertEquals(
    getThermomixModels(["thermomix_TM6", "Thermomix TM6"]),
    ["TM6"],
  );
});

Deno.test("getThermomixModels - handles mixed formats", () => {
  assertEquals(
    getThermomixModels(["thermomix_tm5", "Thermomix TM7"]),
    ["TM7", "TM5"],
  );
});

/**
 * Locale Utilities Tests
 *
 * Verifies locale chain computation, translation picking with fallback,
 * and base language extraction.
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  buildLocaleChain,
  getBaseLanguage,
  getLanguageName,
  pickTranslation,
} from "../locale-utils.ts";

// ============================================================
// buildLocaleChain
// ============================================================

Deno.test("buildLocaleChain - 'en' returns ['en']", () => {
  assertEquals(buildLocaleChain("en"), ["en"]);
});

Deno.test("buildLocaleChain - 'es' returns ['es', 'en']", () => {
  assertEquals(buildLocaleChain("es"), ["es", "en"]);
});

Deno.test("buildLocaleChain - 'es-MX' returns ['es-MX', 'es', 'en']", () => {
  assertEquals(buildLocaleChain("es-MX"), ["es-MX", "es", "en"]);
});

Deno.test("buildLocaleChain - 'fr' returns ['fr', 'en']", () => {
  assertEquals(buildLocaleChain("fr"), ["fr", "en"]);
});

Deno.test("buildLocaleChain - 'pt-BR' returns ['pt-BR', 'pt', 'en']", () => {
  assertEquals(buildLocaleChain("pt-BR"), ["pt-BR", "pt", "en"]);
});

Deno.test("buildLocaleChain - 'en-US' does not duplicate 'en'", () => {
  const chain = buildLocaleChain("en-US");
  assertEquals(chain, ["en-US", "en"]);
  assertEquals(chain.filter((l) => l === "en").length, 1);
});

// ============================================================
// pickTranslation
// ============================================================

const translations = [
  { locale: "en", name: "Chicken Soup" },
  { locale: "es", name: "Sopa de Pollo" },
  { locale: "fr", name: "Soupe de Poulet" },
];

Deno.test("pickTranslation - picks exact locale match", () => {
  const result = pickTranslation(translations, ["es", "en"]);
  assertEquals(result?.name, "Sopa de Pollo");
});

Deno.test("pickTranslation - falls back through chain", () => {
  const result = pickTranslation(translations, ["de", "fr", "en"]);
  assertEquals(result?.name, "Soupe de Poulet");
});

Deno.test("pickTranslation - falls back to English as terminal", () => {
  const result = pickTranslation(translations, ["pt", "en"]);
  assertEquals(result?.name, "Chicken Soup");
});

Deno.test("pickTranslation - returns first translation when no chain match", () => {
  const result = pickTranslation(translations, ["zh", "ja"]);
  assertEquals(result?.name, "Chicken Soup");
});

Deno.test("pickTranslation - returns undefined for empty array", () => {
  assertEquals(pickTranslation([], ["en"]), undefined);
});

Deno.test("pickTranslation - returns undefined for null", () => {
  assertEquals(pickTranslation(null, ["en"]), undefined);
});

Deno.test("pickTranslation - returns undefined for undefined", () => {
  assertEquals(pickTranslation(undefined, ["en"]), undefined);
});

Deno.test("pickTranslation - prefers earlier locale in chain", () => {
  const result = pickTranslation(translations, ["es", "fr", "en"]);
  assertEquals(result?.locale, "es");
});

Deno.test("pickTranslation - es-MX chain falls back to es", () => {
  const result = pickTranslation(translations, ["es-MX", "es", "en"]);
  assertEquals(result?.name, "Sopa de Pollo");
});

// ============================================================
// getBaseLanguage
// ============================================================

Deno.test("getBaseLanguage - extracts base from regional locale", () => {
  assertEquals(getBaseLanguage("es-MX"), "es");
});

Deno.test("getBaseLanguage - returns simple locale unchanged", () => {
  assertEquals(getBaseLanguage("en"), "en");
});

Deno.test("getBaseLanguage - handles pt-BR", () => {
  assertEquals(getBaseLanguage("pt-BR"), "pt");
});

// ============================================================
// getLanguageName
// ============================================================

Deno.test("getLanguageName - returns known name for en", () => {
  assertEquals(getLanguageName("en"), "English");
});

Deno.test("getLanguageName - returns known name for es", () => {
  assertEquals(getLanguageName("es"), "Mexican Spanish");
});

Deno.test("getLanguageName - handles regional locale", () => {
  assertEquals(getLanguageName("es-MX"), "Mexican Spanish");
});

Deno.test("getLanguageName - returns base code for unknown locale", () => {
  assertEquals(getLanguageName("zh"), "zh");
});

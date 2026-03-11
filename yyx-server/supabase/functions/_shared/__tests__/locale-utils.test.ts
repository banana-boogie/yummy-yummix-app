/**
 * Locale Utilities Tests
 *
 * Verifies locale chain computation, translation picking with fallback,
 * base language extraction, language name resolution, and locale mapping.
 *
 * Terminal fallback is "es" (Mexico-first audience).
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  buildLocaleChain,
  getBaseLanguage,
  getLanguageName,
  languageToLocale,
  pickTranslation,
} from "../locale-utils.ts";

// ============================================================
// buildLocaleChain
// ============================================================

Deno.test("buildLocaleChain - 'es' returns ['es'] (es is terminal)", () => {
  assertEquals(buildLocaleChain("es"), ["es"]);
});

Deno.test("buildLocaleChain - 'en' returns ['en', 'es']", () => {
  assertEquals(buildLocaleChain("en"), ["en", "es"]);
});

Deno.test("buildLocaleChain - 'es-MX' returns ['es-MX', 'es']", () => {
  assertEquals(buildLocaleChain("es-MX"), ["es-MX", "es"]);
});

Deno.test("buildLocaleChain - 'en-CA' returns ['en-CA', 'en', 'es']", () => {
  assertEquals(buildLocaleChain("en-CA"), ["en-CA", "en", "es"]);
});

Deno.test("buildLocaleChain - 'fr' returns ['fr', 'es']", () => {
  assertEquals(buildLocaleChain("fr"), ["fr", "es"]);
});

Deno.test("buildLocaleChain - 'pt-BR' returns ['pt-BR', 'pt', 'es']", () => {
  assertEquals(buildLocaleChain("pt-BR"), ["pt-BR", "pt", "es"]);
});

Deno.test("buildLocaleChain - 'en-US' includes base 'en' and terminal 'es'", () => {
  const chain = buildLocaleChain("en-US");
  assertEquals(chain, ["en-US", "en", "es"]);
});

Deno.test("buildLocaleChain - 'es-ES' does not duplicate 'es'", () => {
  const chain = buildLocaleChain("es-ES");
  assertEquals(chain, ["es-ES", "es"]);
  assertEquals(chain.filter((l) => l === "es").length, 1);
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

Deno.test("pickTranslation - falls back to es as terminal", () => {
  const result = pickTranslation(translations, ["pt", "es"]);
  assertEquals(result?.name, "Sopa de Pollo");
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
  const result = pickTranslation(translations, ["es-MX", "es"]);
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

Deno.test("getLanguageName - returns exact match for 'es-ES'", () => {
  assertEquals(getLanguageName("es-ES"), "Spain Spanish");
});

Deno.test("getLanguageName - falls back to base for 'es-MX'", () => {
  assertEquals(getLanguageName("es-MX"), "Mexican Spanish");
});

Deno.test("getLanguageName - returns known name for 'fr'", () => {
  assertEquals(getLanguageName("fr"), "French");
});

Deno.test("getLanguageName - returns locale code for unknown locale", () => {
  assertEquals(getLanguageName("zh"), "zh");
});

Deno.test("getLanguageName - returns locale code for unknown regional locale", () => {
  assertEquals(getLanguageName("zh-TW"), "zh-TW");
});

// ============================================================
// languageToLocale
// ============================================================

Deno.test("languageToLocale - passes through 'en'", () => {
  assertEquals(languageToLocale("en"), "en");
});

Deno.test("languageToLocale - passes through 'es'", () => {
  assertEquals(languageToLocale("es"), "es");
});

Deno.test("languageToLocale - passes through any string unchanged", () => {
  assertEquals(languageToLocale("fr"), "fr");
});

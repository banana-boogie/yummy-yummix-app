/**
 * Locale Utilities Tests
 *
 * Verifies locale chain computation, translation picking with fallback,
 * base language extraction, language name resolution, and locale mapping.
 *
 * No cross-language fallback — es and en are separate user groups.
 * Only within-family fallback is valid (e.g., es-MX → es).
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

Deno.test("buildLocaleChain - 'es' returns ['es']", () => {
  assertEquals(buildLocaleChain("es"), ["es"]);
});

Deno.test("buildLocaleChain - 'en' returns ['en'] (no cross-language fallback)", () => {
  assertEquals(buildLocaleChain("en"), ["en"]);
});

Deno.test("buildLocaleChain - 'es-MX' returns ['es-MX', 'es']", () => {
  assertEquals(buildLocaleChain("es-MX"), ["es-MX", "es"]);
});

Deno.test("buildLocaleChain - 'en-CA' returns ['en-CA', 'en'] (no es fallback)", () => {
  assertEquals(buildLocaleChain("en-CA"), ["en-CA", "en"]);
});

Deno.test("buildLocaleChain - 'fr' returns ['fr'] (no cross-language fallback)", () => {
  assertEquals(buildLocaleChain("fr"), ["fr"]);
});

Deno.test("buildLocaleChain - 'pt-BR' returns ['pt-BR', 'pt'] (no es fallback)", () => {
  assertEquals(buildLocaleChain("pt-BR"), ["pt-BR", "pt"]);
});

Deno.test("buildLocaleChain - 'en-US' includes base 'en' only", () => {
  const chain = buildLocaleChain("en-US");
  assertEquals(chain, ["en-US", "en"]);
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

Deno.test("pickTranslation - picks es when chain includes es", () => {
  const result = pickTranslation(translations, ["pt", "es"]);
  assertEquals(result?.name, "Sopa de Pollo");
});

Deno.test("pickTranslation - returns undefined when no chain match (no translations[0] fallback)", () => {
  const result = pickTranslation(translations, ["zh", "ja"]);
  assertEquals(result, undefined);
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

Deno.test("pickTranslation - single locale chain with match", () => {
  const result = pickTranslation(translations, ["en"]);
  assertEquals(result?.name, "Chicken Soup");
});

Deno.test("pickTranslation - single locale chain without match returns undefined", () => {
  const result = pickTranslation(translations, ["de"]);
  assertEquals(result, undefined);
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


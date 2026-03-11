/**
 * Locale Utilities
 *
 * Helpers for locale-based translation resolution.
 * Computes fallback chains and picks best translation from an array.
 */

/**
 * Compute a locale fallback chain for the given locale.
 *
 * Examples:
 *   "es-MX" -> ["es-MX", "es"]
 *   "es"    -> ["es"]
 *   "en"    -> ["en", "es"]
 *   "fr"    -> ["fr", "es"]
 *
 * Spanish is always the terminal fallback (Mexico-first audience).
 */
export function buildLocaleChain(locale: string): string[] {
  const chain: string[] = [locale];

  // If locale has a region (e.g., "es-MX"), add the base language
  if (locale.includes("-")) {
    const base = locale.split("-")[0];
    if (!chain.includes(base)) {
      chain.push(base);
    }
  }

  // Spanish is the terminal fallback (Mexico-first audience, matches DB resolve_locale())
  if (!chain.includes("es")) {
    chain.push("es");
  }

  return chain;
}

/**
 * Pick the best translation from an array based on a locale fallback chain.
 *
 * @param translations - Array of objects with a `locale` field
 * @param localeChain - Ordered locale preferences (e.g., ["es-MX", "es", "en"])
 * @returns The best matching translation, or undefined if none found
 */
export function pickTranslation<T extends { locale: string }>(
  translations: T[] | null | undefined,
  localeChain: string[],
): T | undefined {
  if (!translations || translations.length === 0) {
    return undefined;
  }

  for (const locale of localeChain) {
    const match = translations.find((t) => t.locale === locale);
    if (match) return match;
  }

  // If no locale chain match, return the first available translation
  return translations[0];
}

/**
 * Get the base language code from a locale (e.g., "es-MX" -> "es", "en" -> "en").
 */
export function getBaseLanguage(locale: string): string {
  return locale.split("-")[0];
}

/**
 * Map a simple language code ("en", "es") to the canonical locale format.
 * This bridges the old `language` column to the new locale system.
 */
export function languageToLocale(language: string): string {
  // The old system only had "en" and "es". Map directly.
  return language;
}

/**
 * Get a human-readable language name for a locale.
 * Tries the full locale first (e.g., "es-ES" -> "Spain Spanish"),
 * then falls back to the base language (e.g., "es" -> "Mexican Spanish").
 */
export function getLanguageName(locale: string): string {
  const LANGUAGE_NAMES: Record<string, string> = {
    en: "English",
    es: "Mexican Spanish",
    "es-ES": "Spain Spanish",
    fr: "French",
    pt: "Portuguese",
    de: "German",
    it: "Italian",
  };
  return LANGUAGE_NAMES[locale] ?? LANGUAGE_NAMES[getBaseLanguage(locale)] ??
    locale;
}

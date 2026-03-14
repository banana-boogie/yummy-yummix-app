/**
 * Locale Utilities
 *
 * Helpers for locale-based translation resolution.
 * Computes fallback chains and picks best translation from an array.
 */

/**
 * Compute a locale fallback chain for the given locale.
 *
 * Only walks up the parent tree within the same language family.
 * No cross-language fallback — es and en are separate user groups.
 *
 * Examples:
 *   "es-MX" -> ["es-MX", "es"]
 *   "es"    -> ["es"]
 *   "en"    -> ["en"]
 *   "en-US" -> ["en-US", "en"]
 *   "fr"    -> ["fr"]
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

  // No match — caller must handle missing translation explicitly
  return undefined;
}

/**
 * Get the base language code from a locale (e.g., "es-MX" -> "es", "en" -> "en").
 */
export function getBaseLanguage(locale: string): string {
  return locale.split("-")[0];
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

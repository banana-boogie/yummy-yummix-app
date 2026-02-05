import { I18n } from "i18n-js";
import { en } from "./locales/en";
import { es } from "./locales/es";

// Translations are now organized into separate files by section
// See: yyx-app/i18n/locales/en/*.ts and yyx-app/i18n/locales/es/*.ts
const translations = {
  en,
  es,
};

const i18n = new I18n(translations);

// Set a default locale - the actual locale will be set by the LanguageProvider
i18n.locale = "en";

// When a value is missing from a language it'll fall back to another language with the key present.
i18n.enableFallback = true;

export default i18n;

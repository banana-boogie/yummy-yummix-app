import React, { createContext, useContext, useState, useEffect } from 'react';
import { getLocales } from 'expo-localization';
import i18n from '../i18n';
import { Platform } from 'react-native';
import { Storage } from '@/utils/storage';
import logger from '@/services/logger';

export type Language = 'es' | 'en';

interface LanguageContextType {
  /** Language code for i18n UI strings ('en' | 'es') */
  language: Language;
  /** Full locale string for data/API calls (e.g. 'es-MX', 'en-US') */
  locale: string;
  setLanguage: (lang: Language) => void;
  /** Set the full locale (updates language too) */
  setLocale: (loc: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Maps a full locale to the i18n Language code.
 * The i18n system only has 'en' and 'es' bundles.
 */
function localeToLanguage(locale: string): Language {
  return locale.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/**
 * Detects the full device locale string based on platform.
 */
function getDeviceLocale(): string {
  try {
    if (Platform.OS !== 'web') {
      const deviceLocale = getLocales()[0];
      // Build full locale like 'es-MX' from languageTag or components
      return deviceLocale.languageTag || deviceLocale.languageCode || 'en';
    }

    if (typeof window !== 'undefined' && window.navigator) {
      const browserLang = window.navigator.language ||
                         (window.navigator as any).userLanguage ||
                         (window.navigator as any).browserLanguage;
      if (browserLang) return browserLang;
    }

    return 'en';
  } catch (error) {
    logger.error('Error getting device locale:', error);
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<string>('en');
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved locale preference or detect from device
  useEffect(() => {
    async function loadLocale() {
      try {
        const storedLocale = await Storage.getItem('preferred-locale');
        // Also check legacy key for backward compat
        const storedLanguage = await Storage.getItem('preferred-language');

        let selectedLocale: string;

        if (storedLocale) {
          selectedLocale = storedLocale;
        } else if (storedLanguage) {
          // Migrate from legacy 'en'/'es' to full locale
          selectedLocale = storedLanguage;
          await Storage.setItem('preferred-locale', selectedLocale);
        } else {
          selectedLocale = getDeviceLocale();
          await Storage.setItem('preferred-locale', selectedLocale);
        }

        const lang = localeToLanguage(selectedLocale);
        setLocaleState(selectedLocale);
        setLanguageState(lang);
        i18n.locale = lang;

        setIsLoading(false);
      } catch (error) {
        logger.error('Error loading locale preference:', error);
        setLocaleState('en');
        setLanguageState('en');
        i18n.locale = 'en';
        setIsLoading(false);
      }
    }

    loadLocale();
  }, []);

  // setLanguage - backward compatible: sets language and derives locale
  const handleSetLanguage = async (newLanguage: Language) => {
    try {
      if (newLanguage === language) return;

      setLanguageState(newLanguage);
      setLocaleState(newLanguage);
      i18n.locale = newLanguage;
      await Storage.setItem('preferred-locale', newLanguage);
      // Also update legacy key for backward compat
      await Storage.setItem('preferred-language', newLanguage);
    } catch (error) {
      logger.error('Error saving language preference:', error);
    }
  };

  // setLocale - sets the full locale and derives language
  const handleSetLocale = async (newLocale: string) => {
    try {
      if (newLocale === locale) return;

      const lang = localeToLanguage(newLocale);
      setLocaleState(newLocale);
      setLanguageState(lang);
      i18n.locale = lang;
      await Storage.setItem('preferred-locale', newLocale);
      await Storage.setItem('preferred-language', lang);
    } catch (error) {
      logger.error('Error saving locale preference:', error);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{
      language,
      locale,
      setLanguage: handleSetLanguage,
      setLocale: handleSetLocale,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

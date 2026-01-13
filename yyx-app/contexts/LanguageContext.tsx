import React, { createContext, useContext, useState, useEffect } from 'react';
import { getLocales } from 'expo-localization';
import i18n from '../i18n';
import { Platform } from 'react-native';
import { Storage } from '@/utils/storage';

export type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Detects the device or browser language based on platform
 * This is the single source of truth for initial language detection
 */
function getDeviceLanguage(): Language {
  try {
    // For mobile devices
    if (Platform.OS !== 'web') {
      const locale = getLocales()[0].languageCode;
      return locale?.toLowerCase().startsWith('es') ? 'es' : 'en';
    }
    
    // For web: use browser's language
    if (typeof window !== 'undefined' && window.navigator) {
      // Get browser language
      const browserLang = window.navigator.language || 
                         (window.navigator as any).userLanguage || 
                         (window.navigator as any).browserLanguage;
      
      if (browserLang && browserLang.toLowerCase().startsWith('es')) {
        return 'es';
      }
    }
    
    // Default fallback
    return 'en';
  } catch (error) {
    console.error('Error getting device language:', error);
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Initialize with a default, but don't set i18n.locale yet
  const [language, setLanguage] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language preference or detect from device
  useEffect(() => {
    async function loadLanguage() {
      try {
        const stored = await Storage.getItem('preferred-language');
        
        let selectedLanguage: Language;
        
        if (stored) {
          // Use stored preference if available
          selectedLanguage = stored as Language;
        } else {
          // Or detect from device/browser
          selectedLanguage = getDeviceLanguage();
          // Save the detected language
          await Storage.setItem('preferred-language', selectedLanguage);
        }
        
        // Update state and i18n
        setLanguage(selectedLanguage);
        i18n.locale = selectedLanguage;
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading language preference:', error);
        // Fallback to English on error
        setLanguage('en');
        i18n.locale = 'en';
        setIsLoading(false);
      }
    }
    
    loadLanguage();
  }, []);

  // Save language preference when it changes
  const handleSetLanguage = async (newLanguage: Language) => {
    try {
      if (newLanguage === language) return;
      
      // Update language immediately
      setLanguage(newLanguage);
      i18n.locale = newLanguage;
      await Storage.setItem('preferred-language', newLanguage);
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ 
      language, 
      setLanguage: handleSetLanguage
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
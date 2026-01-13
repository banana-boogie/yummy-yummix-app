import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Custom storage implementation that handles both web and native environments
const customStorage = {
  getItem: async (key: string) => {
    try {
      // Check if window is defined (client-side)
      if (typeof window !== 'undefined') {
        return await AsyncStorage.getItem(key);
      }
      // Return null during server-side rendering
      return null;
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      // Only attempt to use AsyncStorage on the client-side
      if (typeof window !== 'undefined') {
        return await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Error setting item in storage:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      // Only attempt to use AsyncStorage on the client-side
      if (typeof window !== 'undefined') {
        return await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error removing item from storage:', error);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

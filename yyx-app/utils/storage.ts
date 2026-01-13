import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cross-platform secure storage utility for sensitive data
 * Uses SecureStore on native platforms and localStorage on web
 */
export const SecureStorage = {
  /**
   * Save a value to secure storage
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage on web
        localStorage.setItem(key, value);
      } else {
        // Use SecureStore on native
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error('Error saving to secure storage:', error);
    }
  },

  /**
   * Get a value from secure storage
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage on web
        return localStorage.getItem(key);
      } else {
        // Use SecureStore on native
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error('Error retrieving from secure storage:', error);
      return null;
    }
  },

  /**
   * Remove a value from secure storage
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage on web
        localStorage.removeItem(key);
      } else {
        // Use SecureStore on native
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error('Error removing from secure storage:', error);
    }
  }
};

/**
 * Cross-platform storage utility for non-sensitive data with higher capacity
 * Uses AsyncStorage on native platforms and localStorage on web
 */
export const Storage = {
  /**
   * Save a value to storage
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage on web
        localStorage.setItem(key, value);
      } else {
        // Use AsyncStorage on native (higher capacity than SecureStore)
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  },

  /**
   * Get a value from storage
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage on web
        return localStorage.getItem(key);
      } else {
        // Use AsyncStorage on native
        return await AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.error('Error retrieving from storage:', error);
      return null;
    }
  },

  /**
   * Remove a value from storage
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage on web
        localStorage.removeItem(key);
      } else {
        // Use AsyncStorage on native
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error removing from storage:', error);
    }
  }
}; 
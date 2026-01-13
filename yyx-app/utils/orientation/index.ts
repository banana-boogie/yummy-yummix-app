/**
 * Dimension correction utilities for orientation issues
 * Addresses React Native orientation/dimension bugs when rotating devices
 */

import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Get the current orientation of the device using Expo's orientation API
 * Returns true if device is in portrait mode, false if in landscape
 */
export const getDeviceOrientation = async (): Promise<boolean> => {
  try {
    // Get the current orientation from Expo
    const orientation = await ScreenOrientation.getOrientationAsync();
    
    // Convert Expo orientation values to simple portrait/landscape
    const isPortrait = (
      orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
      orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
    );

    return isPortrait;
  } catch (error) {
    // Fallback - check dimensions
    const { width, height } = Dimensions.get('window');
    return height > width;
  }
};

/**
 * Setup listeners for orientation changes
 */
export const setupOrientationListeners = (
  onOrientationChange: () => void,
  cleanup: (listeners: any[]) => void
) => {
  const listeners: any[] = [];
  
  // Set up orientation change listener from Expo
  const setupExpoListener = async () => {
    try {
      ScreenOrientation.addOrientationChangeListener((event) => {
        onOrientationChange();
      });
    } catch (error) {
    }
  };
  
  setupExpoListener();
  
  // Also set up the regular dimension change listener as backup
  const dimensionsListener = Dimensions.addEventListener('change', (change) => {
    onOrientationChange();
  });
  
  listeners.push(dimensionsListener);
  
  // Return cleanup function
  return () => {
    cleanup(listeners);
    ScreenOrientation.removeOrientationChangeListeners();
  };
};

/**
 * Get the current dimensions and fix them if they don't match the orientation
 */
export const getCorrectedDimensions = async () => {
  // Get the raw dimensions
  const window = Dimensions.get('window');
  
  // Get actual orientation from device via expo-screen-orientation
  const isActuallyPortrait = await getDeviceOrientation();
  const actualOrientation = isActuallyPortrait ? 'PORTRAIT' : 'LANDSCAPE';
  
  // Get raw dimensions and what they suggest about orientation
  let { width, height } = window;
  const isReportedAsPortrait = height > width;
  const reportedOrientation = isReportedAsPortrait ? 'PORTRAIT' : 'LANDSCAPE';

  
  // Track if we fixed dimensions
  let dimensionsFixed = false;
  
  // If the reported orientation doesn't match the actual orientation, swap dimensions
  if (actualOrientation !== reportedOrientation) {
    // Swap dimensions to fix
    const temp = width;
    width = height;
    height = temp;
    dimensionsFixed = true;
  }
  
  return { width, height, fixed: dimensionsFixed };
}; 
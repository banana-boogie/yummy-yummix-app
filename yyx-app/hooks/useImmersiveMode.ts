import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

/**
 * Hook to enable immersive mode by hiding system navigation elements.
 * On Android, hides the navigation bar with overlay-swipe behavior.
 * On iOS, the home indicator is controlled via screenOptions.autoHideHomeIndicator.
 *
 * @param enabled - Whether immersive mode should be active (default: true)
 */
export function useImmersiveMode(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    if (Platform.OS === 'android') {
      // Hide Android navigation bar with swipe-to-reveal behavior
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }

    return () => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
      }
    };
  }, [enabled]);
}

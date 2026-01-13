import { usePathname } from 'expo-router';

/**
 * Hook to determine if the tab bar should be visible based on the current route
 * 
 * @returns boolean - true if the tab bar should be shown, false if it should be hidden
 */
export function useTabBarVisibility() {
  const pathname = usePathname();
  
  // Routes where tab bar should be hidden
  const hiddenPaths: RegExp[] = [
    // /\/recipes\/.*\/cooking-guide/,
    // Add any future paths where you want to hide the tab bar
  ];
  
  return !hiddenPaths.some(pattern => pattern.test(pathname));
} 
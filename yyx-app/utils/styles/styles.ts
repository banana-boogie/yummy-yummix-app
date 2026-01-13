import { Platform } from 'react-native';

/**
 * Creates platform-specific shadow styles to avoid deprecated shadow* properties on web
 * @param color Shadow color
 * @param offsetX Shadow X offset
 * @param offsetY Shadow Y offset
 * @param radius Shadow radius
 * @param opacity Shadow opacity
 * @returns Platform-specific shadow styles
 */
export const createShadow = (
  color: string,
  offsetX: number = 0,
  offsetY: number = 2,
  radius: number = 4,
  opacity: number = 0.1
) => {
  if (Platform.OS === 'web') {
    // Use boxShadow for web
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px rgba(0, 0, 0, ${opacity})`,
    };
  } else if (Platform.OS === 'ios') {
    // Use shadow* properties for iOS
    return {
      shadowColor: color,
      shadowOffset: { width: offsetX, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    };
  } else {
    // Use elevation for Android
    // Convert shadow radius to elevation (approximate)
    const elevation = radius * 0.57;
    return {
      elevation: elevation > 0 ? elevation : 1,
    };
  }
};

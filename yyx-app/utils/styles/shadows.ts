import { Platform } from 'react-native';
import { COLORS } from '@/constants/design-tokens';

interface ShadowOptions {
  color?: string;
  opacity?: number;
  radius?: number;
  offset?: { height: number; width: number };
  elevation?: number;
}

/**
 * Creates platform-specific text shadow styles
 * @param color Text shadow color
 * @param offsetX Text shadow X offset
 * @param offsetY Text shadow Y offset
 * @param radius Text shadow radius
 * @returns Platform-specific text shadow styles
 */
export const createTextShadow = (
  color: string,
  offsetX: number = 1,
  offsetY: number = 1,
  radius: number = 2
) => {
  if (Platform.OS === 'web') {
    // Use textShadow for web
    return {
      textShadow: `${offsetX}px ${offsetY}px ${radius}px ${color}`,
    };
  } else {
    // Use textShadow* properties for native
    return {
      textShadowColor: color,
      textShadowOffset: { width: offsetX, height: offsetY },
      textShadowRadius: radius,
    };
  }
};

/**
 * Creates a cross-platform shadow style object that properly handles
 * web (boxShadow) and native (shadowProps + elevation) platforms.
 * 
 * @param options Shadow configuration options
 * @returns Platform-specific shadow style object
 * 
 * @example
 * const cardStyle = {
 *   ...createShadow(),  // default shadow
 * };
 * 
 * // Or with custom options
 * const headerStyle = {
 *   ...createShadow({
 *     color: COLORS.primary.DEFAULT,
 *     opacity: 0.2,
 *     radius: 8,
 *     offset: { height: 4, width: 0 },
 *   }),
 * };
 */
export function createShadow({
  color = COLORS.neutral.BLACK,
  opacity = 0.1,
  radius = 4,
  offset = { height: 2, width: 0 },
  elevation,
}: ShadowOptions = {}) {
  // Default elevation to radius if not provided
  const shadowElevation = elevation !== undefined ? elevation : radius;

  // For web, convert to CSS boxShadow format
  if (Platform.OS === 'web') {
    // Convert RGB color to rgba() format for web
    const hexToRgba = (hex: string, alpha: number): string => {
      // Default fallback color
      if (!hex || typeof hex !== 'string') {
        return `rgba(0, 0, 0, ${alpha})`;
      }

      // Remove # if present
      const cleanHex = hex.replace('#', '');

      // Convert to RGB
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);

      // Return rgba string
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const rgbaColor = hexToRgba(color, opacity);
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${rgbaColor}`,
    };
  }

  // For native (iOS/Android)
  const nativeShadow: any = {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
  };

  // Add elevation for Android
  if (Platform.OS === 'android') {
    nativeShadow.elevation = shadowElevation;
  }

  return nativeShadow;
}

/**
 * Predefined shadow styles for common use cases
 */
export const SHADOWS = {
  NONE: Platform.select({
    web: { boxShadow: 'none' },
    default: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  }),

  SMALL: createShadow({
    opacity: 0.3,
    radius: 2,
    offset: { height: 1, width: 0 },
    elevation: 1,
    color: COLORS.shadow.DEFAULT,
  }),

  MEDIUM: createShadow({
    opacity: 0.3,
    radius: 4,
    offset: { height: 2, width: 0 },
    elevation: 3,
    color: COLORS.shadow.DEFAULT,
  }),

  LARGE: createShadow({
    opacity: 0.3,
    radius: 8,
    offset: { height: 4, width: 0 },
    elevation: 5,
    color: COLORS.shadow.DEFAULT,
  }),
}; 
import { useWindowDimensions, Platform } from 'react-native';

/**
 * A lightweight hook for device-related information.
 * Use this for conditional rendering (JS logic), NOT for styling.
 * For styling, use NativeWind's responsive prefixes (sm:, md:, lg:).
 * 
 * ## Recommended Usage for Responsive Layouts
 * 
 * Use `isMobile` for layout switching (stacked vs side-by-side):
 * ```tsx
 * const { isMobile } = useDevice();
 * return isMobile ? <MobileLayout /> : <DesktopLayout />;
 * ```
 * 
 * @example
 * const { isMobile, isDesktop } = useDevice();
 * return isMobile ? <StackedForm /> : <TwoColumnForm />;
 */
export function useDevice() {
    const { width } = useWindowDimensions();

    // Breakpoints from tailwind.config.js
    const breakpoints = {
        sm: 576,
        md: 768,
        lg: 1100,
    };

    const getBreakpoint = () => {
        if (width >= breakpoints.lg) return 'lg';
        if (width >= breakpoints.md) return 'md';
        if (width >= breakpoints.sm) return 'sm';
        return 'xs';
    };

    const breakpoint = getBreakpoint();

    return {
        // ===== RECOMMENDED: Use these for layout switching =====
        /** True for screens < 768px (phones & small tablets). Use for mobile-first layouts. */
        isMobile: width < breakpoints.md,
        /** True for screens >= 768px (tablets & desktops). Use for multi-column layouts. */
        isDesktop: width >= breakpoints.md,

        // ===== Breakpoint flags (Up pattern) =====
        isSmallUp: width >= breakpoints.sm,
        isMediumUp: width >= breakpoints.md,
        isLargeUp: width >= breakpoints.lg,

        // ===== Specific breakpoint matches =====
        isSmall: breakpoint === 'sm',
        isMedium: breakpoint === 'md',
        isLarge: breakpoint === 'lg',
        isPhone: breakpoint === 'xs',

        // ===== Platform flags =====
        isWeb: Platform.OS === 'web',
        isNative: Platform.OS !== 'web',
        isIOS: Platform.OS === 'ios',
        isAndroid: Platform.OS === 'android',
    };
}

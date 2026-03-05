/**
 * Application Design Tokens
 * Single source of truth for colors, spacing, typography, and border radius.
 * Shared between Tailwind CSS (Node.js) and TypeScript Application code.
 */

// Primary Colors
const primary = {
    default: '#FEE5E2',
    lighter: '#FFF3EF',
    lightest: '#FCF6F2', // Updated per branding doc
    light: '#FFE9E3',
    medium: '#FFBFB7',
    dark: '#FF9A99',
    darkest: '#D83A3A',
};

const grey = {
    default: '#EDEDED',
    light: '#F8F8F8',
    lightest: '#FAFAFA',
    medium: '#B5B1B1',
    medium_dark: '#828181',
    dark: '#4A4A4A',
};

// Neutral Colors
const neutral = {
    black: '#2D2D2D',
    white: '#FFFFFF',
    transparent: 'transparent',
};

// Background Colors
const background = {
    default: neutral.white,
    secondary: primary.lightest,
    transparent: 'transparent',
};

// Text Colors
const text = {
    default: neutral.black,
    secondary: grey.medium_dark,
    inverse: primary.lightest,
};

// Border Colors
const border = {
    default: grey.medium,
    focus: primary.medium,
};

// Shadow Colors
const shadow = {
    default: neutral.black,
};

// Status Colors
const status = {
    success: '#78A97A', // GREEN
    warning: '#FFA000', // ORANGE
    error: primary.darkest, // RED
    medium: '#ca8a04', // YELLOW-600 (difficulty medium)
};

// Sidebar Colors (for large screen navigation)
const sidebar = {
    background: primary.lightest, // #FCF6F2 - warm cream
    border: '#F0E6DE', // subtle warm border
};

const COLORS = {
    primary,
    grey,
    neutral,
    background,
    text,
    border,
    shadow,
    status,
    sidebar,
};

const GRADIENT = {
    TRANSPARENT_TO_WHITE: ['transparent', COLORS.background.default],
    PRIMARY_TO_WHITE: [COLORS.primary.default, COLORS.primary.lighter, COLORS.neutral.white],
};

const SPACINGS = {
    xxxs: 2,
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 40,
    xxl: 48,
    xxxl: 64,
    xxxxl: 96,
    xxxxxl: 128,
    xxxxxxxl: 192,
    xxxxxxxxl: 256,
    xxxxxxxxxxl: 384,
    xxxxxxxxxxxxl: 512,
    xxxxxxxxxxxxxxl: 640,
};

const RADIUS = {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    round: 9999,
};

const FONTS = {
    HEADING: 'Quicksand',
    SUBHEADING: 'Lexend',
    BODY: 'Montserrat',
    HANDWRITTEN: 'ComingSoon-Regular',
};

const FONT_SIZES = {
    xs: 12,
    sm: 14,
    base: 16,
    md: 18,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 36,
    '4xl': 48,
    '5xl': 60,
    '6xl': 72,
};

const FONT_WEIGHTS = {
    extraLight: '100',
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extraBold: '800',
    black: '900',
};

const TEXT_PRESETS = {
    // Headers
    h1: {
        fontFamily: FONTS.HEADING,
        fontWeight: FONT_WEIGHTS.extraBold,
        fontSize: FONT_SIZES['3xl'],
        color: COLORS.text.default,
    },
    h2: {
        fontFamily: FONTS.HEADING,
        fontWeight: FONT_WEIGHTS.semibold,
        fontSize: FONT_SIZES['2xl'],
        color: COLORS.text.default,
    },
    h3: {
        fontFamily: FONTS.HEADING,
        fontWeight: FONT_WEIGHTS.medium,
        fontSize: FONT_SIZES.lg,
        color: COLORS.text.default,
    },
    subheading: {
        fontFamily: FONTS.SUBHEADING,
        fontWeight: FONT_WEIGHTS.light,
        fontSize: FONT_SIZES.xl,
        color: COLORS.text.default,
    },

    // Body text
    body: {
        fontFamily: FONTS.BODY,
        fontWeight: FONT_WEIGHTS.regular,
        fontSize: FONT_SIZES.base,
        color: COLORS.text.default,
    },
    bodySmall: {
        fontFamily: FONTS.BODY,
        fontWeight: FONT_WEIGHTS.regular,
        fontSize: FONT_SIZES.sm,
        color: COLORS.text.default,
    },

    // Special types
    caption: {
        fontFamily: FONTS.BODY,
        fontSize: FONT_SIZES.sm,
        fontWeight: FONT_WEIGHTS.regular,
        color: COLORS.text.secondary,
    },
    link: {
        fontFamily: FONTS.BODY,
        fontSize: FONT_SIZES.base,
        fontWeight: FONT_WEIGHTS.regular,
        color: COLORS.primary.dark, // Updated to DARK (emphasis) per branding
        textDecorationLine: 'underline',
    },
    handwritten: {
        fontFamily: FONTS.HANDWRITTEN,
        fontWeight: FONT_WEIGHTS.regular,
        fontSize: FONT_SIZES.base,
        color: COLORS.text.default,
    },
};

/**
 * Layout constants for consistent sizing across the app
 * Use these instead of hard-coded pixel values
 */
const LAYOUT = {
    // Sidebar dimensions
    sidebar: {
        width: 80, // Width of the vertical sidebar on large screens
    },
    // Max width constraints for content areas
    maxWidth: {
        recipeList: 1200,   // Recipe cards grid
        recipeDetail: 900,  // Recipe detail content
        cookingGuide: 1000, // Cooking guide steps
        modal: 500,         // Modal dialogs
        // Responsive defaults used by ResponsiveLayout
        mobile: 500,
        tablet: 700,
        desktop: 800,
    },
};

module.exports = {
    COLORS,
    GRADIENT,
    SPACING: SPACINGS,
    BORDER_RADIUS: RADIUS,
    FONTS,
    FONT_SIZES,
    FONT_WEIGHTS,
    TEXT_PRESETS,
    LAYOUT,
};

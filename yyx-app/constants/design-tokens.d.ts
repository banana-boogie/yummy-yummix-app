/**
 * Type definitions for design tokens.
 */

export interface ColorPalette {
    default: string;
    [key: string]: string;
}

export interface Colors {
    primary: ColorPalette;
    grey: ColorPalette;
    neutral: ColorPalette;
    background: ColorPalette;
    text: ColorPalette;
    border: ColorPalette;
    shadow: ColorPalette;
    status: ColorPalette;
    sidebar: {
        background: string;
        border: string;
    };
}

export const COLORS: Colors;

export const GRADIENT: {
    TRANSPARENT_TO_WHITE: readonly [string, string];
    PRIMARY_TO_WHITE: readonly [string, string, string];
};

export const SPACING: {
    readonly xxxs: 2;
    readonly xxs: 4;
    readonly xs: 8;
    readonly sm: 12;
    readonly md: 16;
    readonly lg: 24;
    readonly xl: 32;
    readonly xxl: 48;
    readonly xxxl: 64;
    readonly xxxxl: 96;
    readonly xxxxxl: 128;
    readonly xxxxxxxl: 192;
    readonly xxxxxxxxl: 256;
    readonly xxxxxxxxxxl: 384;
    readonly xxxxxxxxxxxxl: 512;
    readonly xxxxxxxxxxxxxxl: 640;
};

export const BORDER_RADIUS: {
    readonly none: 0;
    readonly xs: 4;
    readonly sm: 8;
    readonly md: 12;
    readonly lg: 16;
    readonly xl: 24;
    readonly xxl: 32;
    readonly round: 9999;
};

export type BorderRadius = keyof typeof BORDER_RADIUS;

export const FONTS: {
    readonly HEADING: 'Quicksand';
    readonly SUBHEADING: 'Lexend';
    readonly BODY: 'Montserrat';
    readonly HANDWRITTEN: 'ComingSoon-Regular';
};

export const FONT_SIZES: {
    readonly xs: 12;
    readonly sm: 14;
    readonly base: 16;
    readonly md: 18;
    readonly lg: 20;
    readonly xl: 24;
    readonly '2xl': 30;
    readonly '3xl': 36;
    readonly '4xl': 48;
    readonly '5xl': 60;
    readonly '6xl': 72;
};

export type FontSize = keyof typeof FONT_SIZES;

export const FONT_WEIGHTS: {
    readonly extraLight: '100';
    readonly light: '300';
    readonly regular: '400';
    readonly medium: '500';
    readonly semibold: '600';
    readonly bold: '700';
    readonly extraBold: '800';
    readonly black: '900';
};

export const TEXT_PRESETS: {
    h1: TextStyle;
    h2: TextStyle;
    h3: TextStyle;
    subheading: TextStyle;
    body: TextStyle;
    bodySmall: TextStyle;
    caption: TextStyle;
    link: TextStyle;
    handwritten: TextStyle;
};

interface TextStyle {
    fontFamily: string;
    fontWeight: string;
    fontSize: number;
    color: string;
    textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through';
}

export type TextPreset = keyof typeof TEXT_PRESETS;
export type TextStylePreset = keyof typeof TEXT_PRESETS;

export const LAYOUT: {
    readonly sidebar: {
        readonly width: 80;
    };
    readonly maxWidth: {
        readonly recipeList: 1200;
        readonly recipeDetail: 900;
        readonly cookingGuide: 1000;
        readonly modal: 500;
        readonly mobile: 500;
        readonly tablet: 700;
        readonly desktop: 800;
    };
};

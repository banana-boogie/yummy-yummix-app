const { COLORS, SPACING, BORDER_RADIUS, FONTS, FONT_SIZES, FONT_WEIGHTS } = require('./constants/design-tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all of your component files.
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: COLORS,
            spacing: {
                ...SPACING,
            },
            borderRadius: BORDER_RADIUS,
            fontFamily: {
                heading: [FONTS.HEADING],
                subheading: [FONTS.SUBHEADING],
                body: [FONTS.BODY],
                handwritten: [FONTS.HANDWRITTEN],
            },
            fontWeight: FONT_WEIGHTS,
            fontSize: FONT_SIZES,
            screens: {
                'sm': '576px',
                'md': '768px',
                'lg': '1100px',
            },
            boxShadow: {
                sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
                md: '0 2px 4px rgba(0, 0, 0, 0.3)',
                lg: '0 4px 8px rgba(0, 0, 0, 0.3)',
            },
        },
    },
    plugins: [],
};

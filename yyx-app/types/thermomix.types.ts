/**
 * Named cooking modes available on TM6 and TM7.
 * Stored as free text in the database to allow new modes without migrations.
 */
export type ThermomixCookingMode =
    | 'slow_cook'
    | 'rice_cooker'
    | 'sous_vide'
    | 'fermentation'
    | 'open_cooking'    // TM7 only
    | 'browning'        // TM7 only (gentle / intense)
    | 'dough'
    | 'turbo'
    | null;

export const THERMOMIX_COOKING_MODES = [
    'slow_cook',
    'rice_cooker',
    'sous_vide',
    'fermentation',
    'open_cooking',
    'browning',
    'dough',
    'turbo',
] as const;

/** Modes available per Thermomix model. */
export const COOKING_MODES_BY_MODEL: Record<ThermomixModel, readonly string[]> = {
    TM5: [],
    TM6: ['slow_cook', 'rice_cooker', 'sous_vide', 'fermentation', 'dough', 'turbo'],
    TM7: ['slow_cook', 'rice_cooker', 'sous_vide', 'fermentation', 'open_cooking', 'browning', 'dough', 'turbo'],
};

export interface ThermomixSettings {
    time: ThermomixTime;
    speed: ThermomixSpeed;
    temperature: ThermomixTemperature;
    temperatureUnit: ThermomixTemperatureUnit;
    isBladeReversed: ThermomixIsBladeReversed;
    mode?: ThermomixCookingMode;
}

export type ThermomixTime = number | null;

export type ThermomixIsBladeReversed = boolean | null;

export type ThermomixTemperatureUnit = 'F' | 'C' | null;

/**
 * Valid Thermomix speed values
 */
export const VALID_SPEEDS = {
    NUMERIC: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const,
    SPECIAL: ['spoon'] as const
};

/**
 * Valid Thermomix speed single value
 */
export type ThermomixSpeedValue = typeof VALID_SPEEDS.NUMERIC[number] | typeof VALID_SPEEDS.SPECIAL[number] | null;

/**
 * Thermomix speed range with start and end values
 */
export interface ThermomixSpeedRange {
    type: 'range';
    start: ThermomixSpeedValue;
    end: ThermomixSpeedValue;
}

/**
 * Thermomix speed single value
 */
export interface ThermomixSpeedSingle {
    type: 'single';
    value: ThermomixSpeedValue;
}

/**
 * Valid Thermomix speed value
 * Can be either a single speed value or a range with start and end values
 */
export type ThermomixSpeed = ThermomixSpeedSingle | ThermomixSpeedRange | null;

/**
 * Thermomix model identifier.
 */
export type ThermomixModel = 'TM5' | 'TM6' | 'TM7';

/**
 * Base temperatures shared by all models (37-120°C).
 */
const BASE_CELSIUS = [37, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 98, 100, 105, 110, 115, 120] as const;

/**
 * Extended temperatures available on TM7 (125-160°C).
 */
const TM7_EXTENDED_CELSIUS = [125, 130, 135, 140, 145, 150, 155, 160] as const;

/**
 * Base Fahrenheit temperatures shared by all models.
 */
const BASE_FAHRENHEIT = [100, 105, 110, 120, 130, 140, 150, 160, 170, 175, 185, 195, 200, 205, 212, 220, 230, 240, 250] as const;

/**
 * Extended Fahrenheit temperatures available on TM7 (257-320°F).
 */
const TM7_EXTENDED_FAHRENHEIT = [257, 266, 275, 284, 293, 302, 311, 320] as const;

/**
 * Model-specific valid Thermomix temperature values.
 */
export const TEMPERATURES_BY_MODEL = {
    TM5: {
        CELSIUS: [...BASE_CELSIUS, 'Varoma'] as const,
        FAHRENHEIT: [...BASE_FAHRENHEIT, 'Varoma'] as const,
    },
    TM6: {
        CELSIUS: [...BASE_CELSIUS, 'Varoma'] as const,
        FAHRENHEIT: [...BASE_FAHRENHEIT, 'Varoma'] as const,
    },
    TM7: {
        CELSIUS: [...BASE_CELSIUS, ...TM7_EXTENDED_CELSIUS, 'Varoma'] as const,
        FAHRENHEIT: [...BASE_FAHRENHEIT, ...TM7_EXTENDED_FAHRENHEIT, 'Varoma'] as const,
    },
} as const;

/**
 * Union of all valid Thermomix temperature values across all models.
 * Use this when the user's model is unknown or for backwards-compatible contexts.
 */
export const VALID_TEMPERATURES_ALL = {
    CELSIUS: [...BASE_CELSIUS, ...TM7_EXTENDED_CELSIUS, 'Varoma'] as const,
    FAHRENHEIT: [...BASE_FAHRENHEIT, ...TM7_EXTENDED_FAHRENHEIT, 'Varoma'] as const,
};

/**
 * Legacy alias — union of all temperatures for backwards compatibility.
 * Prefer TEMPERATURES_BY_MODEL when the user's model is known.
 */
export const VALID_TEMPERATURES = VALID_TEMPERATURES_ALL;

/**
 * Get the valid temperature list for a specific Thermomix model.
 * Falls back to the full union list if model is unknown.
 */
export function getValidTemperatures(model?: ThermomixModel) {
    if (model && model in TEMPERATURES_BY_MODEL) {
        return TEMPERATURES_BY_MODEL[model];
    }
    return VALID_TEMPERATURES_ALL;
}

/**
 * Valid Thermomix temperature values in Celsius
 */
export type ThermomixTemperatureCelsius = typeof VALID_TEMPERATURES.CELSIUS[number];

/**
 * Valid Thermomix temperature values in Fahrenheit
 */
export type ThermomixTemperatureFahrenheit = typeof VALID_TEMPERATURES.FAHRENHEIT[number];

/**
 * Represents a Thermomix temperature value:
 * - ThermomixTemperatureCelsius: Valid temperature in Celsius
 * - ThermomixTemperatureFahrenheit: Valid temperature in Fahrenheit
 * - null: No temperature set
 */
export type ThermomixTemperature = ThermomixTemperatureCelsius | ThermomixTemperatureFahrenheit | null;

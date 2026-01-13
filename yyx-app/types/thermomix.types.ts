export interface ThermomixSettings {
    time: ThermomixTime;
    speed: ThermomixSpeed;
    temperature: ThermomixTemperature;
    temperatureUnit: ThermomixTemperatureUnit;
    isBladeReversed: ThermomixIsBladeReversed;
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
 * Valid Thermomix temperature values
 */
export const VALID_TEMPERATURES = {
    CELSIUS:      [37, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 98, 100, 105, 110, 115, 120, 'Varoma'] as const,
    FAHRENHEIT: [100, 105, 110, 120, 130, 140, 150, 160, 170, 175, 185, 195, 200, 205, 212, 220, 230, 240, 250, 'Varoma'] as const
};

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

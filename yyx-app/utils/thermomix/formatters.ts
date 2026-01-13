import i18n from '@/i18n';
import { ThermomixTemperature, ThermomixSpeedValue, ThermomixTemperatureUnit, VALID_TEMPERATURES, ThermomixSettings } from '@/types/thermomix.types';
import { RawRecipeStep } from '@/types/recipe.api.types';

type MeasurementSystem = 'metric' | 'imperial';
const THERMOMIX_PARAMS = '%thermomix%';

/**
 * Formats time in seconds to a MM : SS format with leading zeros
 */
export const formatTime = (seconds: number): { minutes: string, seconds: string } => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  // Pad both minutes and seconds with leading zeros to ensure 2 digits
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(remainingSeconds).padStart(2, '0');
  
  return { minutes: formattedMinutes, seconds: formattedSeconds };
};


/**
 * Converts a temperature value between measurement systems without formatting
 * 
 * This function takes the temperature from the API and converts it to the
 * user's preferred measurement system, returning a valid ThermomixTemperature value.
 * 
 * @param temp - The temperature value to convert
 * @param sourceUnit - The unit system the temperature is stored in ('C' for Celsius, 'F' for Fahrenheit)
 * @param targetSystem - The user's preferred measurement system ('metric' for Celsius, 'imperial' for Fahrenheit)
 * @returns The converted temperature value as ThermomixTemperature
 */
export const convertTemperature = (
  temp: ThermomixTemperature, 
  sourceUnit: ThermomixTemperatureUnit, 
  targetSystem: MeasurementSystem
): ThermomixTemperature => {
  if (temp === null) return null;
  
  // Handle 'Varoma' special case
  if (temp === 'Varoma') return 'Varoma';

  // Ensure temp is a number for further processing
  const tempValue = Number(temp);
  if (isNaN(tempValue)) return null;

  // Determine if we need to convert
  const isSourceCelsius = sourceUnit !== 'F';
  const targetIsCelsius = targetSystem === 'metric';
  
  // If no conversion needed, just return the original temperature
  if ((isSourceCelsius && targetIsCelsius) || (!isSourceCelsius && !targetIsCelsius)) {
    return temp as ThermomixTemperature;
  }
  
  // Get source and target arrays based on units
  const sourceArray = isSourceCelsius ? VALID_TEMPERATURES.CELSIUS : VALID_TEMPERATURES.FAHRENHEIT;
  const targetArray = isSourceCelsius ? VALID_TEMPERATURES.FAHRENHEIT : VALID_TEMPERATURES.CELSIUS;
  
  // Find closest value in source array (excluding 'Varoma')
  const numericSourceArray = sourceArray.filter(val => typeof val === 'number') as number[];
  const closestValueIndex = numericSourceArray.reduce((prevIndex, currentValue, currentIndex) => {
    return Math.abs(currentValue - tempValue) < Math.abs(numericSourceArray[prevIndex] - tempValue) 
      ? currentIndex 
      : prevIndex;
  }, 0);
  
  // Get the corresponding value from target array
  const convertedTemp = targetArray[closestValueIndex];
  
  return convertedTemp;
}; 

/**
 * Formats a temperature for display, handling unit conversion if needed.
 * 
 * This function takes the temperature from the API and formats it to the user's preferred
 * measurement system, using the VALID_TEMPERATURES mapping instead of calculating conversions.
 * 
 * @param temp - The temperature value to format
 * @param recipeTemperatureUnit - The unit system the temperature is stored in ('C' for Celsius, 'F' for Fahrenheit)
 * @param preferredMeasurementSystem - The user's preferred measurement system ('metric' for Celsius, 'imperial' for Fahrenheit)
 * @returns The formatted temperature string
 */
export const formatTemperature = (
  temp: ThermomixTemperature, 
  recipeTemperatureUnit: ThermomixTemperatureUnit, 
  preferredMeasurementSystem: MeasurementSystem
): string => {
  if (temp === null) return '';
  if (!recipeTemperatureUnit) return '';
  const convertedTemp = convertTemperature(temp, recipeTemperatureUnit, preferredMeasurementSystem);
  
  // Format the result
  return `${convertedTemp}º${preferredMeasurementSystem === 'metric' ? 'C' : 'F'}`;
};

/**
 * Formats Thermomix speed values for display
 */
export const formatSpeed = (speedValue: ThermomixSpeedValue | {start: ThermomixSpeedValue, end: ThermomixSpeedValue}): string => {
  if (speedValue === null) return '';
  
  // Handle the case when we have separate start and end values
  if (typeof speedValue === 'object' && 'start' in speedValue && 'end' in speedValue) {
    const { start, end } = speedValue;
    if (start && end) {
      return i18n.t('recipes.detail.steps.parameters.speed', { speed: `${start}-${end}` });
    }
  }
  
  // Handle single speed value
  return i18n.t('recipes.detail.steps.parameters.speed', { speed: speedValue });
};

/**
 * Formats a recipe step instruction with Thermomix parameters
 */
export const formatInstruction = (instruction: string, thermomix: ThermomixSettings | undefined, measurementSystem: MeasurementSystem): string => {
  const parts: string[] = [];
  if (!instruction) return '';
  if (!thermomix) return instruction;

  // Add time if exists
  if (thermomix.time) {
    const { minutes, seconds } = formatTime(thermomix.time);
    const minutesString = minutes !== '00' ? i18n.t('recipes.detail.steps.parameters.time.minutes', { count: Number(minutes) }) : '';
    const secondsString = seconds !== '00' ? i18n.t('recipes.detail.steps.parameters.time.seconds', { count: Number(seconds) }) : '';

    if (minutesString && secondsString) {
      parts.push(`${minutesString} ${secondsString}`);
    } else if (minutesString) {
      parts.push(minutesString);
    } else if (secondsString) {
      parts.push(secondsString);
    }
  }
  // Add temperature if exists
  if (thermomix.temperature) {
    parts.push(formatTemperature(
      thermomix.temperature, 
      thermomix.temperatureUnit,
      measurementSystem
    ));
  }

  // Add speed if exists
  // Check if we have a range (both start and end) or just a single speed
  if (thermomix.speed) {
    let speedString = '';
    if (thermomix.speed.type === 'range') {
      speedString = formatSpeed({
        start: thermomix.speed.start,
      end: thermomix.speed.end
      });
    } else if (thermomix.speed.type === 'single') {
      speedString = formatSpeed(thermomix.speed.value );
    }

    if (thermomix.isBladeReversed) {
      speedString += ` (${i18n.t('recipes.detail.steps.parameters.reversed')})`;
    }

    parts.push(speedString);
  }
  
  return instruction.replace(THERMOMIX_PARAMS, `**${parts.join(' / ')}**`);
}
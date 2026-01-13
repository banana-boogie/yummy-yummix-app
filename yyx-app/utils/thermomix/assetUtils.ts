import { ThermomixSpeed, ThermomixTemperature, ThermomixTemperatureUnit } from '@/types/thermomix.types';

// Temperature image mapping
const temperatureImages = {
  // Default images for each unit
  'C-default': require('@/assets/images/thermomix/temperature/temp-c-default.png'),
  'F-default': require('@/assets/images/thermomix/temperature/temp-f-default.png'),
  
  // Varoma images for each unit
  'C-Varoma': require('@/assets/images/thermomix/temperature/temp-c-varoma.png'),
  'F-Varoma': require('@/assets/images/thermomix/temperature/temp-f-varoma.png'),
  
  // Celsius temperatures
  'C-37': require('@/assets/images/thermomix/temperature/temp-c-37.png'),
  'C-40': require('@/assets/images/thermomix/temperature/temp-c-40.png'),
  'C-45': require('@/assets/images/thermomix/temperature/temp-c-45.png'),
  'C-50': require('@/assets/images/thermomix/temperature/temp-c-50.png'),
  'C-55': require('@/assets/images/thermomix/temperature/temp-c-55.png'),
  'C-60': require('@/assets/images/thermomix/temperature/temp-c-60.png'),
  'C-65': require('@/assets/images/thermomix/temperature/temp-c-65.png'),
  'C-70': require('@/assets/images/thermomix/temperature/temp-c-70.png'),
  'C-75': require('@/assets/images/thermomix/temperature/temp-c-75.png'),
  'C-80': require('@/assets/images/thermomix/temperature/temp-c-80.png'),
  'C-85': require('@/assets/images/thermomix/temperature/temp-c-85.png'),
  'C-90': require('@/assets/images/thermomix/temperature/temp-c-90.png'),
  'C-95': require('@/assets/images/thermomix/temperature/temp-c-95.png'),
  'C-98': require('@/assets/images/thermomix/temperature/temp-c-98.png'),
  'C-100': require('@/assets/images/thermomix/temperature/temp-c-100.png'),
  'C-105': require('@/assets/images/thermomix/temperature/temp-c-105.png'),
  'C-110': require('@/assets/images/thermomix/temperature/temp-c-110.png'),
  'C-115': require('@/assets/images/thermomix/temperature/temp-c-115.png'),
  'C-120': require('@/assets/images/thermomix/temperature/temp-c-120.png'),
  
  // Fahrenheit temperatures
  'F-100': require('@/assets/images/thermomix/temperature/temp-f-100.png'),
  'F-105': require('@/assets/images/thermomix/temperature/temp-f-105.png'),
  'F-110': require('@/assets/images/thermomix/temperature/temp-f-110.png'),
  'F-120': require('@/assets/images/thermomix/temperature/temp-f-120.png'),
  'F-130': require('@/assets/images/thermomix/temperature/temp-f-130.png'),
  'F-140': require('@/assets/images/thermomix/temperature/temp-f-140.png'),
  'F-150': require('@/assets/images/thermomix/temperature/temp-f-150.png'),
  'F-160': require('@/assets/images/thermomix/temperature/temp-f-160.png'),
  'F-170': require('@/assets/images/thermomix/temperature/temp-f-170.png'),
  'F-175': require('@/assets/images/thermomix/temperature/temp-f-175.png'),
  'F-185': require('@/assets/images/thermomix/temperature/temp-f-185.png'),
  'F-195': require('@/assets/images/thermomix/temperature/temp-f-195.png'),
  'F-200': require('@/assets/images/thermomix/temperature/temp-f-200.png'),
  'F-205': require('@/assets/images/thermomix/temperature/temp-f-205.png'),
  'F-212': require('@/assets/images/thermomix/temperature/temp-f-212.png'),
  'F-220': require('@/assets/images/thermomix/temperature/temp-f-220.png'),
  'F-230': require('@/assets/images/thermomix/temperature/temp-f-230.png'),
  'F-240': require('@/assets/images/thermomix/temperature/temp-f-240.png'),
  'F-250': require('@/assets/images/thermomix/temperature/temp-f-250.png'),
};

// Speed image mapping - Forward direction
const forwardSpeedImages = {
  // Default image
  default: require('@/assets/images/thermomix/speed/speed-default.png'),
  
  // Special case 
  'spoon': require('@/assets/images/thermomix/speed/speed-spoon.png'),
  
  // Speed values
  0.5: require('@/assets/images/thermomix/speed/speed-0.5.png'),
  1: require('@/assets/images/thermomix/speed/speed-1.png'),
  1.5: require('@/assets/images/thermomix/speed/speed-1.5.png'),
  2: require('@/assets/images/thermomix/speed/speed-2.png'),
  2.5: require('@/assets/images/thermomix/speed/speed-2.5.png'),
  3: require('@/assets/images/thermomix/speed/speed-3.png'),
  3.5: require('@/assets/images/thermomix/speed/speed-3.5.png'),
  4: require('@/assets/images/thermomix/speed/speed-4.png'),
  4.5: require('@/assets/images/thermomix/speed/speed-4.5.png'),
  5: require('@/assets/images/thermomix/speed/speed-5.png'),
  5.5: require('@/assets/images/thermomix/speed/speed-5.5.png'),
  6: require('@/assets/images/thermomix/speed/speed-6.png'),
  6.5: require('@/assets/images/thermomix/speed/speed-6.5.png'),
  7: require('@/assets/images/thermomix/speed/speed-7.png'),
  7.5: require('@/assets/images/thermomix/speed/speed-7.5.png'),
  8: require('@/assets/images/thermomix/speed/speed-8.png'),
  8.5: require('@/assets/images/thermomix/speed/speed-8.5.png'),
  9: require('@/assets/images/thermomix/speed/speed-9.png'),
  9.5: require('@/assets/images/thermomix/speed/speed-9.5.png'),
  10: require('@/assets/images/thermomix/speed/speed-10.png'),
};

// Speed image mapping - Reverse direction
const reverseSpeedImages = {
  // Default image
  default: require('@/assets/images/thermomix/speed/speed-reverse-default.png'),
  
  // Special case 
  'spoon': require('@/assets/images/thermomix/speed/speed-reverse-spoon.png'),
  
  // Speed values - all available reverse speeds
  0.5: require('@/assets/images/thermomix/speed/speed-reverse-0.5.png'),
  1: require('@/assets/images/thermomix/speed/speed-reverse-1.png'),
  1.5: require('@/assets/images/thermomix/speed/speed-reverse-1.5.png'),
  2: require('@/assets/images/thermomix/speed/speed-reverse-2.png'),
  2.5: require('@/assets/images/thermomix/speed/speed-reverse-2.5.png'),
  3: require('@/assets/images/thermomix/speed/speed-reverse-3.png'),
  3.5: require('@/assets/images/thermomix/speed/speed-reverse-3.5.png'),
  4: require('@/assets/images/thermomix/speed/speed-reverse-4.png'),
  4.5: require('@/assets/images/thermomix/speed/speed-reverse-4.5.png'),
  5: require('@/assets/images/thermomix/speed/speed-reverse-5.png'),
  5.5: require('@/assets/images/thermomix/speed/speed-reverse-5.5.png'),
  6: require('@/assets/images/thermomix/speed/speed-reverse-6.png'),
  6.5: require('@/assets/images/thermomix/speed/speed-reverse-6.5.png'),
  7: require('@/assets/images/thermomix/speed/speed-reverse-7.png'),
  7.5: require('@/assets/images/thermomix/speed/speed-reverse-7.5.png'),
  8: require('@/assets/images/thermomix/speed/speed-reverse-8.png'),
  8.5: require('@/assets/images/thermomix/speed/speed-reverse-8.5.png'),
  9: require('@/assets/images/thermomix/speed/speed-reverse-9.png'),
  9.5: require('@/assets/images/thermomix/speed/speed-reverse-9.5.png'),
  10: require('@/assets/images/thermomix/speed/speed-reverse-10.png'),
};

/**
 * Get the appropriate image for a temperature setting
 * 
 * @param temperature - The temperature value to get the image for
 * @param temperatureUnit - The unit of the temperature value that you want to display
 * @returns The appropriate image for the temperature setting
 */
export function getTemperatureImage(
  temperature: ThermomixTemperature, 
  temperatureUnit: ThermomixTemperatureUnit = 'C'
) {
  if (!temperature) return temperatureUnit === 'C' 
    ? temperatureImages['C-default'] 
    : temperatureImages['F-default'];
  
  // Handle special case for 'Varoma' (same for both units)
  if (temperature === 'Varoma') {
    return temperatureUnit === 'C' 
      ? temperatureImages['C-Varoma'] 
      : temperatureImages['F-Varoma'];
  }
  
  // Create the key with the temperature unit and value
  const key = `${temperatureUnit}-${temperature}`;
  
  // @ts-ignore - Key might not exist in our mapping
  // Fall back to appropriate default based on temperatureUnit
  return temperatureImages[key] || (temperatureUnit === 'C' 
    ? temperatureImages['C-default'] 
    : temperatureImages['F-default']);
}

/**
 * Get the appropriate image for a speed setting
 */
export function getSpeedImage(speed: ThermomixSpeed, isBladeReversed: boolean = false) {
  // If no speed, return appropriate default
  if (!speed) return isBladeReversed 
    ? reverseSpeedImages.default 
    : forwardSpeedImages.default;
  
  // For ranges, always return the default speed image
  if (speed.type === 'range') {
    return isBladeReversed 
      ? reverseSpeedImages.default 
      : forwardSpeedImages.default;
  }
  
  // Determine which image map to use
  const speedImages = isBladeReversed ? reverseSpeedImages : forwardSpeedImages;
  
  // @ts-ignore - We know these keys exist in our asset mapping
  return speedImages[speed.value] || speedImages.default;
}

/**
 * Format the display text for a speed value
 * Used for displaying text on top of the speed image
 */
export function formatSpeedText(speed: ThermomixSpeed): string {
  if (!speed) return '-';
  
  if (speed.type === 'range') {
    return `${speed.start}-${speed.end}`;
  }
  
  return speed.value?.toString() || '-';
}

/**
 * Get the time circle image
 */
export function getTimeImage() {
  return require('@/assets/images/thermomix/time/time-default.png');
} 
import React from 'react';
import { View, Image, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { ThermomixSpeed, ThermomixTemperature, ThermomixTemperatureUnit, ThermomixIsBladeReversed, ThermomixTime, ThermomixCookingMode, COOKING_MODE_LABELS } from '@/types/thermomix.types';
import { getTemperatureImage, getSpeedImage, getTimeImage, formatSpeedText } from '@/utils/thermomix/assetUtils';
import { formatTime } from '@/utils/thermomix/formatters';
import { useDevice } from '@/hooks/useDevice';
import { useLanguage } from '@/contexts/LanguageContext';

interface ThermomixCookingParametersProps {
  time?: ThermomixTime;     // time in seconds
  temperature?: ThermomixTemperature;
  temperatureUnit?: ThermomixTemperatureUnit;
  speed?: ThermomixSpeed;
  isBladeReversed?: ThermomixIsBladeReversed;  // Whether to show reversed blade speed images
  mode?: ThermomixCookingMode;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

/**
 * Displays the cooking parameters for a Thermomix recipe
 */
export function ThermomixCookingParameters({
  time,
  temperature,
  temperatureUnit = 'C',
  speed,
  isBladeReversed = false,
  mode,
  className = '',
  style
}: ThermomixCookingParametersProps) {
  const { isPhone } = useDevice();
  const { language } = useLanguage();

  // Responsive icon size: keep mobile original (135), make desktop larger (200)
  const iconSize = isPhone ? 135 : 200;

  // Add a check to determine if any parameter is present
  const shouldShowCircles = time !== undefined || temperature !== undefined || speed !== undefined;

  // Determine if we need to show speed text (for ranges)
  const shouldShowSpeedText = speed?.type === 'range';

  const { minutes, seconds } = time ? formatTime(time) : { minutes: '--', seconds: '--' };

  return (
    <View className={`items-center ${className}`} style={style}>
      {mode && COOKING_MODE_LABELS[mode] && (
        <View className="bg-primary-medium/20 rounded-lg px-sm py-xxs mb-xs">
          <Text preset="body" className="text-text-default font-medium">
            {COOKING_MODE_LABELS[mode][language] ?? COOKING_MODE_LABELS[mode].es}
          </Text>
        </View>
      )}
      {shouldShowCircles && (
        <View className="flex-row justify-center">
          {/* Time Circle */}
          <View className="relative items-center justify-center">
            <Image
              source={getTimeImage()}
              style={{ width: iconSize, height: iconSize, marginHorizontal: -8 }}
            />
            <View className="absolute flex-row items-center justify-center gap-[1px]">
              <Text className="text-2xl font-medium">
                {minutes}
              </Text>
              <Text className="text-2xl font-medium">
                :
              </Text>
              <Text className="text-2xl font-medium">
                {seconds}
              </Text>
            </View>
          </View>

          {/* Temperature Circle */}
          <View className="relative items-center justify-center">
            <Image
              source={getTemperatureImage(temperature || null, temperatureUnit)}
              style={{ width: iconSize, height: iconSize, marginHorizontal: -8 }}
            />
          </View>

          {/* Speed Circle */}
          <View className="relative items-center justify-center">
            <Image
              source={getSpeedImage(speed || null, !!isBladeReversed)}
              style={{ width: iconSize, height: iconSize, marginHorizontal: -8 }}
            />
            {shouldShowSpeedText && (
              <Text className="absolute text-2xl font-medium">
                {formatSpeedText(speed)}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
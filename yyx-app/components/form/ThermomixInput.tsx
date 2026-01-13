import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import { ThermomixSettings, ThermomixTemperature, VALID_TEMPERATURES, VALID_SPEEDS, ThermomixSpeedValue, ThermomixSpeed, ThermomixSpeedRange } from '@/types/thermomix.types';
import { COLORS } from '@/constants/design-tokens';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

interface ThermomixInputFormProps {
  initialValues?: Partial<ThermomixSettings>;
  onChange: (settings: Partial<ThermomixSettings>) => void;
  className?: string; // Add className support
}

export const ThermomixInput: React.FC<ThermomixInputFormProps> = ({
  initialValues = {},
  onChange,
  className = ''
}) => {
  // Initialize with default empty values if not provided
  const [settings, setSettings] = useState<Partial<ThermomixSettings>>({
    time: initialValues.time || null,
    temperature: initialValues.temperature || null,
    temperatureUnit: initialValues.temperatureUnit || 'C',
    speed: initialValues.speed || null,
    isBladeReversed: initialValues.isBladeReversed || false,
  });

  // UI state for showing temperature and speed selectors
  const [showTemperatureSelector, setShowTemperatureSelector] = useState(false);
  const [showSpeedSelector, setShowSpeedSelector] = useState(false);
  const [speedMode, setSpeedMode] = useState<'single' | 'range'>('single');

  // Sync with initialValues when they change
  useEffect(() => {
    setSettings({
      time: initialValues.time || null,
      temperature: initialValues.temperature || null,
      temperatureUnit: initialValues.temperatureUnit || 'C',
      speed: initialValues.speed || null,
      isBladeReversed: initialValues.isBladeReversed || false,
    });

    // Determine initial speed mode based on the speed type
    if (initialValues.speed) {
      if (initialValues.speed.type === 'range') {
        setSpeedMode('range');
      } else if (initialValues.speed.type === 'single') {
        setSpeedMode('single');
      }
    }
  }, [initialValues]);

  // Helper to get speed value from ThermomixSpeed object
  const getSpeedValue = (speed: ThermomixSpeed | undefined): ThermomixSpeedValue => {
    if (!speed) return null;
    if (speed.type === 'single') return speed.value;
    return null;
  };

  // Update parent component when settings change due to user actions
  const updateParent = (newSettings: Partial<ThermomixSettings>) => {
    setSettings(newSettings);
    onChange(newSettings);
  };

  // Time handlers
  const handleMinutesChange = (value: string) => {
    const minutes = parseInt(value, 10) || 0;
    const seconds = settings.time ? settings.time % 60 : 0;

    updateParent({
      ...settings,
      time: minutes * 60 + seconds
    });
  };

  const handleSecondsChange = (value: string) => {
    const seconds = parseInt(value, 10) || 0;
    const minutes = settings.time ? Math.floor(settings.time / 60) : 0;

    updateParent({
      ...settings,
      time: minutes * 60 + seconds
    });
  };

  // Temperature handlers
  const handleTemperatureSelect = (temp: ThermomixTemperature) => {
    updateParent({
      ...settings,
      temperature: temp
    });
    setShowTemperatureSelector(false);
  };

  const toggleTemperatureUnit = () => {
    const newUnit = settings.temperatureUnit === 'C' ? 'F' : 'C';
    // Convert temperature if needed
    let newTemp = settings.temperature;

    // If there's a temperature set, find the closest equivalent in the other unit
    if (settings.temperature && settings.temperature !== 'Varoma') {
      const currentIndex = (settings.temperatureUnit === 'C' ?
        VALID_TEMPERATURES.CELSIUS :
        VALID_TEMPERATURES.FAHRENHEIT)
        .findIndex(t => t === settings.temperature);

      if (currentIndex !== -1) {
        newTemp = (newUnit === 'C' ?
          VALID_TEMPERATURES.CELSIUS :
          VALID_TEMPERATURES.FAHRENHEIT)[currentIndex];
      }
    }

    updateParent({
      ...settings,
      temperatureUnit: newUnit,
      temperature: newTemp
    });
  };

  // Helper to check if a speed value is selected in current mode
  const isSpeedSelected = (speedValue: ThermomixSpeedValue): boolean => {
    if (!settings.speed) return false;

    if (speedMode === 'single') {
      return settings.speed.type === 'single' && settings.speed.value === speedValue;
    } else {
      return settings.speed.type === 'range' &&
        (settings.speed.start === speedValue || settings.speed.end === speedValue);
    }
  };

  // Handle Speed handlers
  const handleSpeedModeChange = (mode: 'single' | 'range') => {
    setSpeedMode(mode);

    if (mode === 'single') {
      updateParent({
        ...settings,
        speed: { type: 'single', value: getSpeedValue(settings.speed) }
      });
    } else {
      updateParent({
        ...settings,
        speed: { type: mode, start: null, end: null }
      });
    }
  };

  const handleSpeedSelect = (speedValue: ThermomixSpeedValue) => {
    if (speedMode === 'single') {
      const newSettings = {
        ...settings,
        speed: speedValue ? { type: 'single' as const, value: speedValue } : null
      };

      updateParent(newSettings);
      setShowSpeedSelector(false);
    } else if (speedMode === 'range') {
      // For range mode, we need to handle start and end values
      let currentSpeedRange: ThermomixSpeedRange;

      // Make sure we have a properly typed range speed object
      if (!settings.speed || settings.speed.type !== 'range') {
        currentSpeedRange = { type: 'range' as const, start: null, end: null };
      } else {
        currentSpeedRange = settings.speed as ThermomixSpeedRange;
      }

      let newSettings: Partial<ThermomixSettings>;

      if (currentSpeedRange.start === null) {
        // First selection: set as start speed
        newSettings = {
          ...settings,
          speed: { type: 'range' as const, start: speedValue, end: null }
        };
        setSettings(newSettings);
      } else if (currentSpeedRange.end === null) {
        // Second selection: set as end speed
        let newStart = currentSpeedRange.start;
        let newEnd = speedValue;

        // If spoon is involved, it's always the smallest
        if (speedValue === 'spoon') {
          newStart = 'spoon';
          newEnd = currentSpeedRange.start;
        }
        // For numeric speed values, ensure start < end
        else if (typeof speedValue === 'number' && typeof currentSpeedRange.start === 'number') {
          if (speedValue < currentSpeedRange.start) {
            newStart = speedValue;
            newEnd = currentSpeedRange.start;
          }
        }

        newSettings = {
          ...settings,
          speed: { type: 'range' as const, start: newStart, end: newEnd }
        };

        // Update parent and close selector now that we have both values
        updateParent(newSettings);
        setShowSpeedSelector(false);
      } else {
        // Already have start and end speeds, so start a new range
        setSettings({
          ...settings,
          speed: { type: 'range' as const, start: speedValue, end: null }
        });
      }
    }
  };

  // Helper to check if a speed is between start and end speeds
  const isSpeedInRange = (speedValue: ThermomixSpeedValue) => {
    if (speedMode !== 'range' || !settings.speed || settings.speed.type !== 'range') {
      return false;
    }

    const { start, end } = settings.speed;
    if (!start || !end) return false;

    // If checking 'spoon' - it's in range only if both start and end are numeric 
    // and 'spoon' should be treated as the smallest possible value
    if (speedValue === 'spoon') {
      return false; // 'spoon' can't be "between" any values as it's the lowest
    }

    // If start is 'spoon', then any numeric speed is greater than start
    if (start === 'spoon' && typeof end === 'number' && typeof speedValue === 'number') {
      return speedValue < end;
    }

    // If end is 'spoon', this is an unusual case, but no speed would be in range
    // since 'spoon' is the lowest value
    if (end === 'spoon') {
      return false;
    }

    // Handle normal numeric speeds range
    if (typeof start === 'number' && typeof end === 'number' && typeof speedValue === 'number') {
      return speedValue > start && speedValue < end;
    }

    return false;
  };

  const toggleBladeDirection = (isReversed: boolean) => {
    updateParent({
      ...settings,
      isBladeReversed: isReversed
    });
  };

  const getTemperatureDisplayText = () => {
    if (!settings.temperature) return 'Temperature OFF';
    return `${settings.temperature}°${settings.temperatureUnit}`;
  };

  const getSpeedDisplayText = () => {
    const speed = settings.speed;

    if (speedMode === 'single') {
      if (!speed) return 'Speed OFF';

      if (speed.type !== 'single') return 'Speed OFF';
      if (speed.value === null) return 'Select a speed';
      if (speed.value === 'spoon') return 'Spoon mode';
      return `Speed ${speed.value}`;
    } else {
      if (!speed) return 'Select start speed';
      if (speed.type !== 'range') return 'Select start speed';
      if (!speed.start) return 'Select start speed';
      if (!speed.end) return `Speed ${speed.start} to ...`;
      return `Speed ${speed.start} to ${speed.end}`;
    }
  };

  return (
    <View className={`w-full rounded-md overflow-hidden p-md border-[0.5px] border-border-default ${className}`}>

      {/* Time Input */}
      <View className="mb-lg flex-col gap-xs">
        <Text preset="subheading" className="mb-xs text-text-secondary">Time</Text>
        <View className="flex-row gap-md">
          <TextInput
            value={settings.time !== undefined && settings.time !== null ? Math.floor(settings.time / 60).toString() : '0'}
            onChangeText={handleMinutesChange}
            keyboardType="numeric"
            numericOnly={true}
            className="border-border-default rounded-sm max-w-[150px]"
            label="Minutes"
          />

          <TextInput
            value={settings.time !== undefined && settings.time !== null ? (settings.time % 60).toString() : '0'}
            onChangeText={handleSecondsChange}
            keyboardType="numeric"
            numericOnly={true}
            className="border-border-default rounded-sm max-w-[150px]"
            label="Seconds"
          />
        </View>
      </View>

      {/* Temperature Selector */}
      <View className="mb-lg">
        <Text preset="subheading" className="mb-xs text-text-secondary">Temperature</Text>
        <TouchableOpacity
          className={`
            flex-row justify-between items-center p-md border border-border-default rounded-md mb-md bg-background
            ${showTemperatureSelector ? 'border-primary-dark' : ''}
          `}
          onPress={() => setShowTemperatureSelector(!showTemperatureSelector)}
        >
          <View className="flex-row items-center">
            <Ionicons name="thermometer-outline" size={24} className="text-text-default mr-sm" />
            <Text preset="body">
              {getTemperatureDisplayText()}
            </Text>
          </View>
          <Ionicons
            name={showTemperatureSelector ? "chevron-up" : "chevron-down"}
            size={24}
            className="text-text-secondary"
          />
        </TouchableOpacity>

        {showTemperatureSelector && (
          <View className="-mt-md mb-md border border-t-0 border-primary-dark rounded-b-md p-md bg-background">

            {/* Temperature Unit Selector */}
            <View className="mb-md border-b border-border-default pb-sm">
              <View className="flex-row border border-border-default rounded-md overflow-hidden max-w-[150px]">
                <TouchableOpacity
                  className={`
                    flex-1 py-xs px-md items-center justify-center bg-background
                    ${settings.temperatureUnit === 'C' ? 'bg-primary-default' : ''}
                  `}
                  onPress={() => toggleTemperatureUnit()}
                >
                  <Text
                    preset="body"
                    className={settings.temperatureUnit === 'C' ? 'text-text-default font-bold' : 'text-text-default'}
                  >
                    °C
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`
                    flex-1 py-xs px-md items-center justify-center bg-background
                    ${settings.temperatureUnit === 'F' ? 'bg-primary-default' : ''}
                  `}
                  onPress={() => toggleTemperatureUnit()}
                >
                  <Text
                    preset="body"
                    className={settings.temperatureUnit === 'F' ? 'text-text-default font-bold' : 'text-text-default'}
                  >
                    °F
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              className="p-sm rounded-sm bg-background-secondary items-center justify-center my-xxs border border-border-default mb-md"
              onPress={() => handleTemperatureSelect(null)}
            >
              <Text preset="body">OFF</Text>
            </TouchableOpacity>

            <View className="flex-row flex-wrap justify-start">
              {(settings.temperatureUnit === 'C' ? VALID_TEMPERATURES.CELSIUS : VALID_TEMPERATURES.FAHRENHEIT)
                .filter(temp => temp !== 'Varoma')
                .map(temp => (
                  <TouchableOpacity
                    key={temp.toString()}
                    className={`
                      p-sm rounded-sm bg-background-secondary items-center justify-center m-xxs
                      ${settings.temperature === temp ? 'bg-primary-default' : ''}
                    `}
                    onPress={() => handleTemperatureSelect(temp)}
                  >
                    <Text
                      preset="body"
                      className={settings.temperature === temp ? 'text-text-default font-bold' : ''}
                    >
                      {temp}°
                    </Text>
                  </TouchableOpacity>
                ))
              }
              <TouchableOpacity
                className={`
                  p-sm rounded-sm bg-background-secondary items-center justify-center m-xxs
                  ${settings.temperature === 'Varoma' ? 'bg-primary-default' : ''}
                `}
                onPress={() => handleTemperatureSelect('Varoma')}
              >
                <Text
                  preset="body"
                  className={settings.temperature === 'Varoma' ? 'text-text-default font-bold' : ''}
                >
                  Varoma
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Speed Selector */}
      <View className="mb-lg">
        <Text preset="subheading" className="mb-xs text-text-secondary">Speed</Text>
        <TouchableOpacity
          className={`
            flex-row justify-between items-center p-md border border-border-default rounded-md mb-md bg-background
            ${showSpeedSelector ? 'border-primary-dark' : ''}
          `}
          onPress={() => setShowSpeedSelector(!showSpeedSelector)}
        >
          <View className="flex-row items-center">
            {settings.isBladeReversed === false ? (
              <Image source={require('@/assets/images/thermomix/speed/speed.png')}
                tintColor={COLORS.text.default}
                style={{ width: 24, height: 24, marginRight: 4 }} />
            ) : (
              <Image source={require('@/assets/images/thermomix/speed/speed-reverse.png')}
                tintColor={COLORS.text.default}
                style={{ width: 24, height: 24, marginRight: 4 }} />
            )}
            <Text preset="body">{getSpeedDisplayText()}</Text>
          </View>
          <Ionicons
            name={showSpeedSelector ? "chevron-up" : "chevron-down"}
            size={24}
            className="text-text-secondary"
          />
        </TouchableOpacity>

        {showSpeedSelector && (
          <View className="-mt-md mb-md border border-t-0 border-primary-dark rounded-b-md p-md bg-background">
            {/* Remove Speed Button */}
            <TouchableOpacity
              className="bg-background-secondary p-sm rounded-md items-center justify-center mb-md border border-border-default"
              onPress={() => {
                updateParent({
                  ...settings,
                  speed: null
                });
                setShowSpeedSelector(false);
              }}
            >
              <Text preset="body" className="text-text-default font-bold mb-0">
                OFF
              </Text>
            </TouchableOpacity>

            {/* Speed Mode Toggle */}
            <View className="flex-row mb-md border border-border-default rounded-md overflow-hidden">
              <TouchableOpacity
                className={`
                  flex-1 py-sm items-center
                  ${speedMode === 'single' ? 'bg-primary-default' : ''}
                `}
                onPress={() => handleSpeedModeChange('single')}
              >
                <Text
                  preset="body"
                  className={`mb-0 ${speedMode === 'single' ? 'text-text-default font-bold' : 'text-text-default'}`}
                >
                  Single
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`
                  flex-1 py-sm items-center
                  ${speedMode === 'range' ? 'bg-primary-default' : ''}
                `}
                onPress={() => handleSpeedModeChange('range')}
              >
                <Text
                  preset="body"
                  className={`mb-0 ${speedMode === 'range' ? 'text-text-default font-bold' : 'text-text-default'}`}
                >
                  Range
                </Text>
              </TouchableOpacity>
            </View>

            {/* Speed Grid */}
            <View className="flex-row flex-wrap justify-center gap-xxs">
              {/* Spoon Option now inside grid */}
              <TouchableOpacity
                key="spoon"
                className={`
                  p-sm rounded-sm bg-background-secondary items-center justify-center m-xxs w-[50px] h-[50px]
                  ${isSpeedSelected('spoon') ? 'bg-primary-default' : ''}
                `}
                onPress={() => handleSpeedSelect('spoon')}
              >
                <FontAwesome
                  name="spoon"
                  size={24}
                  className={isSpeedSelected('spoon') ? "text-text-default" : "text-text-default"}
                  style={{ transform: [{ rotate: '45deg' }] }}
                />
              </TouchableOpacity>

              {VALID_SPEEDS.NUMERIC.map(speed => {
                // Check if speed is between start and end in range mode
                const isInRange = isSpeedInRange(speed);

                return (
                  <TouchableOpacity
                    key={speed.toString()}
                    className={`
                      p-sm rounded-sm bg-background-secondary items-center justify-center m-xxs w-[50px] h-[50px]
                      ${isSpeedSelected(speed) ? 'bg-primary-default' : ''}
                      ${isInRange ? 'bg-primary-light opacity-70' : ''}
                    `}
                    onPress={() => handleSpeedSelect(speed)}
                  >
                    <Text
                      preset="body"
                      className={`
                        mb-0
                        ${isSpeedSelected(speed) ? 'text-text-default font-bold' : ''}
                        ${isInRange ? 'text-text-default' : ''}
                      `}
                    >
                      {speed}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Blade Direction - without heading */}
            <View className="flex-row justify-end gap-md mt-md">
              <TouchableOpacity
                className={`
                  flex-row items-center justify-center p-sm rounded-sm bg-background-secondary w-[50px] h-[50px]
                  ${settings.isBladeReversed === false ? 'bg-primary-default' : ''}
                `}
                onPress={() => toggleBladeDirection(false)}
              >
                <Image source={require('@/assets/images/thermomix/speed/speed.png')}
                  style={{ width: 32, height: 32 }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                className={`
                  flex-row items-center justify-center p-sm rounded-sm bg-background-secondary w-[50px] h-[50px]
                  ${settings.isBladeReversed ? 'bg-primary-default' : ''}
                `}
                onPress={() => toggleBladeDirection(true)}
              >
                <Image source={require('@/assets/images/thermomix/speed/speed-reverse.png')}
                  style={{ width: 32, height: 32 }}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

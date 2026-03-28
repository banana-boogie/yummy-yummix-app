import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { renderRecipeText } from '@/components/recipe-detail/RenderRecipeText';
import { formatTime, formatTemperature, formatInstruction } from '@/utils/thermomix/formatters';
import { AdminRecipeSteps, getTranslatedField } from '@/types/recipe.admin.types';
import { ThermomixSettings, ThermomixSpeedRange } from '@/types/thermomix.types';
import i18n from '@/i18n';
import { Image } from 'expo-image';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';

interface RecipeStepContentProps {
  recipeStep: AdminRecipeSteps;
  displayLocale?: string;
}

export function RecipeStepContent({
  recipeStep,
  displayLocale = 'es',
}: RecipeStepContentProps) {
  const { isMobile } = useDevice();

  // Helper function to render speed text
  const renderSpeedText = () => {
    if (!recipeStep.thermomixSpeed) return null;

    // Check for speed range
    if (recipeStep.thermomixSpeed.type === 'range') {
      return `${i18n.t('recipes.detail.steps.parameters.speed', { speed: `${recipeStep.thermomixSpeed.start}-${recipeStep.thermomixSpeed.end}` })}`;
    }
    // Single speed
    else if (recipeStep.thermomixSpeed.type === 'single') {
      return `${i18n.t('recipes.detail.steps.parameters.speed', { speed: recipeStep.thermomixSpeed.value })}`;
    }

    return null;
  };

  const instruction = getTranslatedField(recipeStep.translations, displayLocale, 'instruction');
  const tip = getTranslatedField(recipeStep.translations, displayLocale, 'tip');

  // Preview thermomix parameters formatting
  const formatStep = () => {
    // Check if thermomixSpeed is a SpeedRange
    let speed_start: number | undefined = undefined;
    let speed_end: number | undefined = undefined;

    if (recipeStep?.thermomixSpeed && typeof recipeStep?.thermomixSpeed === 'object') {
      const speedRange = recipeStep.thermomixSpeed as ThermomixSpeedRange;
      speed_start = Number(speedRange.start);
      speed_end = Number(speedRange.end);
    }

    const measurementSystem = (recipeStep.thermomixTemperatureUnit || 'C') === 'C' ? 'metric' : 'imperial';

    const thermomix = {
      time: recipeStep.thermomixTime || null,
      temperature: recipeStep.thermomixTemperature || null,
      speed: recipeStep.thermomixSpeed || null,
      temperatureUnit: recipeStep.thermomixTemperatureUnit || 'C',
      isBladeReversed: recipeStep.thermomixIsBladeReversed || false
    } as ThermomixSettings;
    return formatInstruction(instruction, thermomix, measurementSystem);
  };

  const formattedStep = formatStep();

  const { seconds, minutes } = recipeStep.thermomixTime !== null ? formatTime(recipeStep.thermomixTime || 0) : { seconds: '', minutes: '' };

  return (
    <View className="p-md">
      {/* Step instruction */}
      <View className="flex-col gap-sm mb-sm">
        {formattedStep !== undefined ? (
          <View className="mb-xs border border-border-default rounded-sm p-xs bg-background-default">
            {formattedStep ? (
              <View className="mt-xs">
                {renderRecipeText(formattedStep, {
                  textStyle: { color: COLORS.text.default, marginBottom: 4 },
                  boldStyle: { fontWeight: 'bold', color: COLORS.text.default },
                })}
              </View>
            ) : (
              <Text className="italic text-text-secondary mt-xs">
                {i18n.t('admin.recipes.form.stepsInfo.noStepText')}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {/* Display ingredients used in this recipeStep if present */}
      {recipeStep.ingredients && recipeStep.ingredients.length > 0 ? (
        <View className="mt-md mb-md bg-background-secondary rounded-md p-md">
          <Text preset="caption" fontWeight="700" className="mb-sm">
            {i18n.t('admin.recipes.form.stepsInfo.stepIngredients')}
          </Text>
          {isMobile ? (
            /* Mobile Layout - Vertical list with full width cards */
            <View className="flex-col gap-md">
              {recipeStep.ingredients.map((recipeIngredient, index) => (
                <View
                  key={`recipeIngredient-${recipeIngredient.id || index}`}
                  className="bg-background-default p-sm rounded-md border border-border-default"
                >
                  <View className="flex-row items-center mb-sm">
                    <Image
                      source={recipeIngredient.ingredient?.pictureUrl}
                      className="w-10 h-10 rounded-sm"
                      contentFit="cover"
                      transition={300}
                      cachePolicy="memory-disk"
                    />
                    <View className="flex-1 ml-sm">
                      <Text fontWeight="700" className="text-base">{getTranslatedField(recipeIngredient.ingredient?.translations, displayLocale, 'name')}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center pt-xs border-t border-border-default">
                    <Text className="text-sm">{recipeIngredient.quantity} {getTranslatedField(recipeIngredient.measurementUnit?.translations, displayLocale, 'symbol')}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            /* Desktop Layout - Wrapped horizontal cards */
            <View className="flex-row flex-wrap gap-md">
              {recipeStep.ingredients.map((recipeIngredient, index) => (
                <View key={`recipeIngredient-${recipeIngredient.id || index}`} className="bg-background-default p-sm rounded-sm border border-border-default flex-row items-start gap-sm max-w-[320px]">
                  <Image
                    source={recipeIngredient.ingredient?.pictureUrl}
                    className="w-12 h-12 rounded-sm mt-[2px]"
                    contentFit="cover"
                    transition={300}
                    cachePolicy="memory-disk"
                  />
                  <View className="flex-1">
                    <View className="w-full">
                      <View className="mb-xs flex-row items-center">
                        <View className="flex-row items-center flex-wrap mr-sm">
                          <Text fontWeight="700">{getTranslatedField(recipeIngredient.ingredient?.translations, displayLocale, 'name')}</Text>
                        </View>
                        <Text className="bg-background-secondary px-[2px] rounded-xs text-xs text-text-secondary ml-auto">
                          {recipeIngredient.quantity} {getTranslatedField(recipeIngredient.measurementUnit?.translations, displayLocale, 'symbol')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* Display thermomix settings if present */}
      {recipeStep.thermomixTime || recipeStep.thermomixSpeed || recipeStep.thermomixTemperature ? (
        <View className="my-md bg-background-secondary rounded-md p-sm">
          <Text preset="caption" fontWeight="700" className="mb-xs text-text-secondary">
            {i18n.t('admin.recipes.form.stepsInfo.thermomixParameters')}
          </Text>
          <View className="flex-row flex-wrap gap-sm">
            {recipeStep.thermomixTime ? (
              <View className="flex-row items-center gap-[2px]">
                <Ionicons name="time-outline" size={16} className="text-text-secondary" />
                <Text preset="caption" className="mb-0">
                  {i18n.t('recipes.detail.steps.parameters.time.minutes', { count: Number(minutes) })} {i18n.t('recipes.detail.steps.parameters.time.seconds', { count: Number(seconds) })}
                </Text>
              </View>
            ) : null}

            {recipeStep.thermomixTemperature ? (
              <View className="flex-row items-center gap-[2px]">
                <Ionicons name="thermometer-outline" size={16} className="text-text-secondary" />
                <Text preset="caption">
                  {formatTemperature(
                    recipeStep.thermomixTemperature,
                    recipeStep.thermomixTemperatureUnit || 'C',
                    recipeStep.thermomixTemperatureUnit === 'F' ? 'imperial' : 'metric'
                  )}
                </Text>
              </View>
            ) : null}

            {recipeStep.thermomixSpeed ? (
              <View className="flex-row items-center gap-[2px]">
                <Ionicons name="speedometer-outline" size={16} className="text-text-secondary" />
                <Text preset="caption" className="mb-0">
                  {renderSpeedText()}
                </Text>
              </View>
            ) : null}

            {recipeStep.thermomixIsBladeReversed ? (
              <View className="flex-row items-center gap-[2px]">
                <Ionicons name="sync-outline" size={16} className="text-text-secondary" />
                <Text preset="caption" className="mb-0">
                  {i18n.t('admin.recipes.form.stepsInfo.thermomixIsBladeReversed')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Display tips if present */}
      {tip ? (
        <View className="my-md bg-background-secondary rounded-md p-sm">
          <Text preset="caption" fontWeight="700" className="mb-xs text-text-secondary">
            {i18n.t('admin.recipes.form.stepsInfo.tipTitle')}
          </Text>
          <View className="flex-col p-md gap-sm rounded-md bg-background-default">
            <Text preset="caption">
              {tip}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default RecipeStepContent;
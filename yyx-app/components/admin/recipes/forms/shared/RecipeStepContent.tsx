import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { renderRecipeText } from '@/components/recipe-detail/RenderRecipeText';
import { formatTime, formatTemperature, formatInstruction } from '@/utils/thermomix/formatters';
import { AdminRecipeSteps } from '@/types/recipe.admin.types';
import { ThermomixSettings, ThermomixSpeedRange } from '@/types/thermomix.types';
import i18n from '@/i18n';
import { Image } from 'expo-image';
import { LanguageBadge } from '@/components/common/LanguageBadge';
import { RawRecipeStep } from '@/types/recipe.api.types';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';

interface RecipeStepContentProps {
  recipeStep: AdminRecipeSteps;
}

export function RecipeStepContent({
  recipeStep,
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

  // Preview thermomix parameters formatting
  const formatStep = (language: string = 'en') => {
    // Check if thermomixSpeed is a SpeedRange
    let speed_start: number | undefined = undefined;
    let speed_end: number | undefined = undefined;

    if (recipeStep?.thermomixSpeed && typeof recipeStep?.thermomixSpeed === 'object') {
      const speedRange = recipeStep.thermomixSpeed as ThermomixSpeedRange;
      speed_start = Number(speedRange.start);
      speed_end = Number(speedRange.end);
    }

    // Create raw recipe instruction for formatter
    const rawRecipeStep = {
      id: recipeStep.id,
      recipe_id: '',
      order: recipeStep.order,
      instruction_en: recipeStep.instructionEn,
      instruction_es: recipeStep.instructionEs,
      thermomix_time: recipeStep.thermomixTime || null,
      thermomix_temperature: recipeStep.thermomixTemperature || null,
      thermomix_speed: typeof recipeStep.thermomixSpeed === 'number' ? recipeStep.thermomixSpeed : null,
      thermomix_speed_start: speed_start,
      thermomix_speed_end: speed_end,
      recipe_section_en: recipeStep.recipeSectionEn || '',
      recipe_section_es: recipeStep.recipeSectionEs || '',
      thermomix_temperature_unit: recipeStep.thermomixTemperatureUnit || 'C'
    } as RawRecipeStep;

    const measurementSystem = rawRecipeStep.thermomix_temperature_unit === 'C' ? 'metric' : 'imperial';

    const instruction = rawRecipeStep[`instruction_${language}` as 'instruction_en' | 'instruction_es'];
    const thermomix = {
      time: recipeStep.thermomixTime || null,
      temperature: recipeStep.thermomixTemperature || null,
      speed: recipeStep.thermomixSpeed || null,
      temperatureUnit: recipeStep.thermomixTemperatureUnit || 'C',
      isBladeReversed: recipeStep.thermomixIsBladeReversed || false
    } as ThermomixSettings;
    return formatInstruction(instruction, thermomix, measurementSystem);
  };

  const formattedStepEn = formatStep('en');
  const formattedStepEs = formatStep('es');

  const { seconds, minutes } = recipeStep.thermomixTime !== null ? formatTime(recipeStep.thermomixTime || 0) : { seconds: '', minutes: '' };

  return (
    <View className="p-md">
      {/* Steps in both languages */}
      <View className="flex-col gap-sm mb-sm">
        {/* English Steps */}
        {formattedStepEn !== undefined ? (
          <View className="mb-xs border border-border-DEFAULT rounded-sm p-xs bg-background-DEFAULT">
            <Text preset="caption" fontWeight="700" className="text-text-SECONDARY mb-[2px]">
              {i18n.t('common.english')}
            </Text>
            {formattedStepEn ? (
              <View>
                {renderRecipeText(formattedStepEn, {
                  textStyle: { color: COLORS.text.DEFAULT, marginBottom: 4 }, // Standard text color
                  boldStyle: { fontWeight: 'bold', color: COLORS.text.DEFAULT },
                })}
              </View>
            ) : (
              <Text className="italic text-text-SECONDARY">
                {i18n.t('admin.recipes.form.stepsInfo.noStepText')}
              </Text>
            )}
          </View>
        ) : null}

        {/* Spanish Steps */}
        {formattedStepEs !== undefined ? (
          <View className="mb-xs border border-border-DEFAULT rounded-sm p-xs bg-background-DEFAULT">
            <Text preset="caption" fontWeight="700" className="text-text-SECONDARY mb-[2px]">
              {i18n.t('common.spanish')}
            </Text>
            {formattedStepEs ? (
              <View>
                {renderRecipeText(formattedStepEs, {
                  textStyle: { color: COLORS.text.DEFAULT, marginBottom: 4 },
                  boldStyle: { fontWeight: 'bold', color: COLORS.text.DEFAULT },
                })}
              </View>
            ) : (
              <Text className="italic text-text-SECONDARY">
                {i18n.t('admin.recipes.form.stepsInfo.noStepText')}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {/* Display ingredients used in this recipeStep if present */}
      {recipeStep.ingredients && recipeStep.ingredients.length > 0 ? (
        <View className="mt-md mb-md bg-background-SECONDARY rounded-md p-md">
          <Text preset="caption" fontWeight="700" className="mb-sm">
            {i18n.t('admin.recipes.form.stepsInfo.stepIngredients')}
          </Text>
          {isMobile ? (
            /* Mobile Layout - Vertical list with full width cards */
            <View className="flex-col gap-md">
              {recipeStep.ingredients.map((recipeIngredient, index) => (
                <View
                  key={`recipeIngredient-${recipeIngredient.id || index}`}
                  className="bg-background-DEFAULT p-sm rounded-md border border-border-DEFAULT"
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
                      <Text fontWeight="700" className="text-base">{recipeIngredient.ingredient?.nameEn}</Text>
                      <Text className="text-sm text-text-SECONDARY">{recipeIngredient.ingredient?.nameEs}</Text>
                    </View>
                  </View>
                  <View className="flex-row justify-between items-center pt-xs border-t border-border-DEFAULT">
                    <View className="flex-row items-center">
                      <LanguageBadge language="EN" size="small" />
                      <Text className="text-sm ml-xs">{recipeIngredient.quantity} {recipeIngredient.measurementUnit?.symbolEn || ''}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <LanguageBadge language="ES" size="small" />
                      <Text className="text-sm ml-xs">{recipeIngredient.quantity} {recipeIngredient.measurementUnit?.symbolEs || ''}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            /* Desktop Layout - Wrapped horizontal cards */
            <View className="flex-row flex-wrap gap-md">
              {recipeStep.ingredients.map((recipeIngredient, index) => (
                <View key={`recipeIngredient-${recipeIngredient.id || index}`} className="bg-background-DEFAULT p-sm rounded-sm border border-border-DEFAULT flex-row items-start gap-sm max-w-[320px]">
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
                          <LanguageBadge language="EN" size="small" />
                          <Text fontWeight="700" className="ml-1">{recipeIngredient.ingredient?.nameEn}</Text>
                        </View>
                        <Text className="bg-background-SECONDARY px-[2px] rounded-xs text-xs text-text-SECONDARY ml-auto">
                          {recipeIngredient.quantity} {recipeIngredient.measurementUnit?.symbolEn || ''}
                        </Text>
                      </View>
                      <View className="mb-xs flex-row items-center">
                        <View className="flex-row items-center flex-wrap mr-sm">
                          <LanguageBadge language="ES" size="small" />
                          <Text fontWeight="700" className="ml-1">{recipeIngredient.ingredient?.nameEs}</Text>
                        </View>
                        <Text className="bg-background-SECONDARY px-[2px] rounded-xs text-xs text-text-SECONDARY ml-auto">
                          {recipeIngredient.quantity} {recipeIngredient.measurementUnit?.symbolEs || ''}
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
        <View className="my-md bg-background-SECONDARY rounded-md p-sm">
          <Text preset="caption" fontWeight="700" className="mb-xs text-text-SECONDARY">
            {i18n.t('admin.recipes.form.stepsInfo.thermomixParameters')}
          </Text>
          <View className="flex-row flex-wrap gap-sm">
            {recipeStep.thermomixTime ? (
              <View className="flex-row items-center gap-[2px]">
                <Ionicons name="time-outline" size={16} className="text-text-SECONDARY" />
                <Text preset="caption" className="mb-0">
                  {i18n.t('recipes.detail.steps.parameters.time.minutes', { count: Number(minutes) })} {i18n.t('recipes.detail.steps.parameters.time.seconds', { count: Number(seconds) })}
                </Text>
              </View>
            ) : null}

            {recipeStep.thermomixTemperature ? (
              <View className="flex-row items-center gap-[2px]">
                <Ionicons name="thermometer-outline" size={16} className="text-text-SECONDARY" />
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
                <Ionicons name="speedometer-outline" size={16} className="text-text-SECONDARY" />
                <Text preset="caption" className="mb-0">
                  {renderSpeedText()}
                </Text>
              </View>
            ) : null}

            {recipeStep.thermomixIsBladeReversed ? (
              <View className="flex-row items-center gap-[2px]">
                <Ionicons name="sync-outline" size={16} className="text-text-SECONDARY" />
                <Text preset="caption" className="mb-0">
                  {i18n.t('admin.recipes.form.stepsInfo.thermomixIsBladeReversed')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Display tips if present */}
      {recipeStep.tipEn || recipeStep.tipEs ? (
        <View className="my-md bg-background-SECONDARY rounded-md p-sm">
          <Text preset="caption" fontWeight="700" className="mb-xs text-text-SECONDARY">
            {i18n.t('admin.recipes.form.stepsInfo.tipTitle')}
          </Text>
          <View className="flex-col p-md gap-sm rounded-md bg-background-DEFAULT">
            {recipeStep.tipEn ? (
              <View className="flex-row items-center gap-sm">
                <LanguageBadge language="EN" size="small" />
                <Text preset="caption">
                  {recipeStep.tipEn}
                </Text>
              </View>
            ) : null}
            {recipeStep.tipEs ? (
              <View className="flex-row items-center gap-sm">
                <LanguageBadge language="ES" size="small" />
                <Text preset="caption">
                  {recipeStep.tipEs}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default RecipeStepContent;
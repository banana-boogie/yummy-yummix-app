import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { Switch } from '@/components/common/Switch';
import { TextInput } from '@/components/form/TextInput';
import { FormGroup } from '@/components/form/FormGroup';
import { FormRow } from '@/components/form/FormRow';
import { SelectInput, SelectOption } from '@/components/form/SelectInput';
import { MultiSelect } from '@/components/form/MultiSelect';
import {
  AdminRecipe,
  AdminRecipeTag,
  pickTranslation,
} from '@/types/recipe.admin.types';
import {
  CookingLevel,
  EquipmentTag,
  FoodGroup,
  PlannerRole,
} from '@/types/recipe.types';
import { adminRecipeTagService } from '@/services/admin/adminRecipeTagService';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/services/logger';

// Tag category name convention: meal types are any tags whose categories include this string
// (case-insensitive match against TAG category labels like "Meal Type"/"MEAL_TYPE").
const MEAL_TYPE_CATEGORY_MATCH = /meal\s*type/i;

interface MyWeekSetupFormProps {
  recipe: Partial<AdminRecipe>;
  onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
  displayLocale?: string;
}

export function MyWeekSetupForm({ recipe, onUpdateRecipe, displayLocale = 'es' }: MyWeekSetupFormProps) {
  const { user } = useAuth();
  const [allTags, setAllTags] = useState<AdminRecipeTag[]>([]);

  useEffect(() => {
    adminRecipeTagService
      .getAllTags()
      .then(setAllTags)
      .catch((e) => logger.error('Failed to load tags for meal types:', e));
  }, []);

  const mealTypeTags = useMemo(
    () => allTags.filter(t => (t.categories || []).some(c => MEAL_TYPE_CATEGORY_MATCH.test(c))),
    [allTags],
  );

  const plannerRoleOptions: SelectOption[] = [
    { label: i18n.t('admin.recipes.form.myWeekSetup.plannerRole.main'), value: 'main' },
    { label: i18n.t('admin.recipes.form.myWeekSetup.plannerRole.side'), value: 'side' },
    { label: i18n.t('admin.recipes.form.myWeekSetup.plannerRole.dessert'), value: 'dessert' },
    { label: i18n.t('admin.recipes.form.myWeekSetup.plannerRole.snack'), value: 'snack' },
    { label: i18n.t('admin.recipes.form.myWeekSetup.plannerRole.condiment'), value: 'condiment' },
  ];

  const foodGroupOptions = [
    { label: i18n.t('admin.recipes.form.myWeekSetup.foodGroups.protein'), value: 'protein' as FoodGroup },
    { label: i18n.t('admin.recipes.form.myWeekSetup.foodGroups.carb'), value: 'carb' as FoodGroup },
    { label: i18n.t('admin.recipes.form.myWeekSetup.foodGroups.veg'), value: 'veg' as FoodGroup },
    { label: i18n.t('admin.recipes.form.myWeekSetup.foodGroups.dessert'), value: 'dessert' as FoodGroup },
  ];

  const equipmentOptions = [
    { label: i18n.t('admin.recipes.form.myWeekSetup.equipment.thermomix'), value: 'thermomix' as EquipmentTag },
    { label: i18n.t('admin.recipes.form.myWeekSetup.equipment.airFryer'), value: 'air_fryer' as EquipmentTag },
    { label: i18n.t('admin.recipes.form.myWeekSetup.equipment.oven'), value: 'oven' as EquipmentTag },
    { label: i18n.t('admin.recipes.form.myWeekSetup.equipment.stovetop'), value: 'stovetop' as EquipmentTag },
    { label: i18n.t('admin.recipes.form.myWeekSetup.equipment.none'), value: 'none' as EquipmentTag },
  ];

  const cookingLevelOptions: SelectOption[] = [
    { label: i18n.t('admin.recipes.form.myWeekSetup.cookingLevel.beginner'), value: 'beginner' },
    { label: i18n.t('admin.recipes.form.myWeekSetup.cookingLevel.intermediate'), value: 'intermediate' },
    { label: i18n.t('admin.recipes.form.myWeekSetup.cookingLevel.experienced'), value: 'experienced' },
  ];

  const mealTypeOptions = mealTypeTags.map(t => ({
    label: pickTranslation(t.translations, displayLocale)?.name
      || pickTranslation(t.translations, 'es')?.name
      || pickTranslation(t.translations, 'en')?.name
      || '—',
    value: t.id,
  }));

  const selectedTags = (recipe.tags as AdminRecipeTag[]) || [];
  const selectedMealTypeIds = selectedTags
    .filter(t => mealTypeTags.some(mt => mt.id === t.id))
    .map(t => t.id);

  const handleMealTypesChange = (ids: string[]) => {
    // Keep any non-meal-type tags untouched; replace only meal-type ones
    const nonMealType = selectedTags.filter(t => !mealTypeTags.some(mt => mt.id === t.id));
    const newMealTypes = mealTypeTags.filter(mt => ids.includes(mt.id));
    onUpdateRecipe({ tags: [...nonMealType, ...newMealTypes] });
  };

  const foodGroups = recipe.foodGroups || [];
  const equipmentTags = recipe.equipmentTags || [];
  const hasMealType = selectedMealTypeIds.length > 0;
  const isPublished = recipe.isPublished === true;
  const isEligible =
    Boolean(recipe.plannerRole) && foodGroups.length >= 1 && hasMealType && isPublished;

  const missingLabels: string[] = [];
  if (!recipe.plannerRole) missingLabels.push(i18n.t('admin.recipes.form.myWeekSetup.eligibility.missing.plannerRole'));
  if (foodGroups.length === 0) missingLabels.push(i18n.t('admin.recipes.form.myWeekSetup.eligibility.missing.foodGroups'));
  if (!hasMealType) missingLabels.push(i18n.t('admin.recipes.form.myWeekSetup.eligibility.missing.mealTypes'));
  if (!isPublished) missingLabels.push(i18n.t('admin.recipes.form.myWeekSetup.eligibility.missing.publish'));

  const handleVerifiedToggle = (on: boolean) => {
    if (on) {
      // Store user.id for stable attribution (verified_by is TEXT).
      // If/when a UI surfaces verified_by to users, revisit whether to store an admin display name.
      onUpdateRecipe({
        verifiedAt: new Date().toISOString(),
        verifiedBy: user?.id || null,
      });
    } else {
      onUpdateRecipe({ verifiedAt: null, verifiedBy: null });
    }
  };

  return (
    <View className="w-full">
      {/* Eligibility indicator */}
      <View
        className={`p-md rounded-md mb-md ${isEligible ? 'bg-status-success/10' : 'bg-status-error/10'}`}
      >
        <Text
          preset="subheading"
          className={isEligible ? 'text-status-success' : 'text-status-error'}
        >
          {isEligible
            ? i18n.t('admin.recipes.form.myWeekSetup.eligibility.ready')
            : i18n.t('admin.recipes.form.myWeekSetup.eligibility.missingTitle')}
        </Text>
        {!isEligible && missingLabels.length > 0 && (
          <Text className="text-status-error mt-xs">
            {i18n.t('admin.recipes.form.myWeekSetup.eligibility.need')}{' '}
            {missingLabels.join(', ')}
          </Text>
        )}
      </View>

      {/* Planner role */}
      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.myWeekSetup.plannerRole.label')}
          helperText={i18n.t('admin.recipes.form.myWeekSetup.plannerRole.tooltip')}
          required
        >
          <SelectInput
            value={recipe.plannerRole || ''}
            options={plannerRoleOptions}
            onValueChange={(value) => onUpdateRecipe({ plannerRole: value as PlannerRole })}
            placeholder={i18n.t('admin.recipes.form.myWeekSetup.plannerRole.placeholder')}
          />
        </FormGroup>
      </FormRow>

      {/* Food groups */}
      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.myWeekSetup.foodGroups.label')}
          helperText={i18n.t('admin.recipes.form.myWeekSetup.foodGroups.tooltip')}
          required
        >
          <MultiSelect
            options={foodGroupOptions.map(o => ({ label: o.label, value: o.value }))}
            selectedValues={foodGroups}
            onValueChange={(values) => onUpdateRecipe({ foodGroups: values as FoodGroup[] })}
            placeholder={i18n.t('admin.recipes.form.myWeekSetup.foodGroups.placeholder')}
          />
        </FormGroup>
      </FormRow>

      {/* Complete meal */}
      <View className="flex-row items-center justify-between mb-md">
        <View className="flex-1 pr-md">
          <Text preset="body" className="text-text-default font-semibold">
            {i18n.t('admin.recipes.form.myWeekSetup.isCompleteMeal.label')}
          </Text>
          <Text preset="bodySmall" className="text-text-secondary">
            {i18n.t('admin.recipes.form.myWeekSetup.isCompleteMeal.tooltip')}
          </Text>
        </View>
        <Switch
          value={!!recipe.isCompleteMeal}
          onValueChange={(v) => onUpdateRecipe({ isCompleteMeal: v })}
        />
      </View>

      {/* Equipment */}
      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.myWeekSetup.equipment.label')}
          helperText={i18n.t('admin.recipes.form.myWeekSetup.equipment.tooltip')}
        >
          <MultiSelect
            options={equipmentOptions.map(o => ({ label: o.label, value: o.value }))}
            selectedValues={equipmentTags}
            onValueChange={(values) => onUpdateRecipe({ equipmentTags: values as EquipmentTag[] })}
            placeholder={i18n.t('admin.recipes.form.myWeekSetup.equipment.placeholder')}
          />
        </FormGroup>
      </FormRow>

      {/* Meal types (tags) */}
      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.myWeekSetup.mealTypes.label')}
          helperText={i18n.t('admin.recipes.form.myWeekSetup.mealTypes.tooltip')}
          required
        >
          {mealTypeOptions.length === 0 ? (
            <Text preset="bodySmall" className="text-text-secondary">
              {i18n.t('admin.recipes.form.myWeekSetup.mealTypes.empty')}
            </Text>
          ) : (
            <MultiSelect
              options={mealTypeOptions}
              selectedValues={selectedMealTypeIds}
              onValueChange={handleMealTypesChange}
              placeholder={i18n.t('admin.recipes.form.myWeekSetup.mealTypes.placeholder')}
            />
          )}
        </FormGroup>
      </FormRow>

      {/* Cooking level */}
      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.myWeekSetup.cookingLevel.label')}
          helperText={i18n.t('admin.recipes.form.myWeekSetup.cookingLevel.tooltip')}
        >
          <SelectInput
            value={recipe.cookingLevel || ''}
            options={cookingLevelOptions}
            onValueChange={(value) => onUpdateRecipe({ cookingLevel: value as CookingLevel })}
            placeholder={i18n.t('admin.recipes.form.myWeekSetup.cookingLevel.placeholder')}
          />
        </FormGroup>
      </FormRow>

      {/* Leftovers friendly */}
      <View className="flex-row items-center justify-between mb-md">
        <View className="flex-1 pr-md">
          <Text preset="body" className="text-text-default font-semibold">
            {i18n.t('admin.recipes.form.myWeekSetup.leftoversFriendly.label')}
          </Text>
          <Text preset="bodySmall" className="text-text-secondary">
            {i18n.t('admin.recipes.form.myWeekSetup.leftoversFriendly.tooltip')}
          </Text>
        </View>
        <Switch
          value={!!recipe.leftoversFriendly}
          onValueChange={(v) => onUpdateRecipe({ leftoversFriendly: v })}
        />
      </View>

      {/* Batch friendly */}
      <View className="flex-row items-center justify-between mb-md">
        <View className="flex-1 pr-md">
          <Text preset="body" className="text-text-default font-semibold">
            {i18n.t('admin.recipes.form.myWeekSetup.batchFriendly.label')}
          </Text>
          <Text preset="bodySmall" className="text-text-secondary">
            {i18n.t('admin.recipes.form.myWeekSetup.batchFriendly.tooltip')}
          </Text>
        </View>
        <Switch
          value={!!recipe.batchFriendly}
          onValueChange={(v) => onUpdateRecipe({ batchFriendly: v })}
        />
      </View>

      {/* Max household size */}
      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.myWeekSetup.maxHouseholdSize.label')}
          helperText={i18n.t('admin.recipes.form.myWeekSetup.maxHouseholdSize.tooltip')}
        >
          <TextInput
            value={recipe.maxHouseholdSizeSupported?.toString() || ''}
            onChangeText={(text) => {
              const n = parseInt(text);
              onUpdateRecipe({
                maxHouseholdSizeSupported: Number.isFinite(n) && n > 0 ? n : null,
              });
            }}
            keyboardType="numeric"
          />
        </FormGroup>
      </FormRow>

      {/* Scaling notes */}
      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.myWeekSetup.scalingNotes.label')}
          helperText={i18n.t('admin.recipes.form.myWeekSetup.scalingNotes.tooltip')}
        >
          <TextInput
            value={recipe.requiresMultiBatchNote || ''}
            onChangeText={(text) => onUpdateRecipe({ requiresMultiBatchNote: text || null })}
            multiline
            numberOfLines={3}
            className="min-h-[80px] p-md"
            style={{ textAlignVertical: 'top' }}
            placeholder={i18n.t('admin.recipes.form.myWeekSetup.scalingNotes.placeholder')}
          />
        </FormGroup>
      </FormRow>

      {/* Verified */}
      <View className="flex-row items-center justify-between mb-md">
        <View className="flex-1 pr-md">
          <Text preset="body" className="text-text-default font-semibold">
            {i18n.t('admin.recipes.form.myWeekSetup.verified.label')}
          </Text>
          <Text preset="bodySmall" className="text-text-secondary">
            {i18n.t('admin.recipes.form.myWeekSetup.verified.tooltip')}
          </Text>
          {recipe.verifiedAt && (
            <Text preset="caption" className="text-text-secondary mt-xs">
              {i18n.t('admin.recipes.form.myWeekSetup.verified.verifiedAt', {
                date: new Date(recipe.verifiedAt).toLocaleDateString(),
              })}
            </Text>
          )}
        </View>
        <Switch
          value={!!recipe.verifiedAt}
          onValueChange={handleVerifiedToggle}
        />
      </View>
    </View>
  );
}

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { v4 as generateUUID } from 'uuid'
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { AdminRecipe, AdminRecipeSteps } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import StepFormModal from './RecipeStepFormModal';
import RecipeStepContent from '@/components/admin/recipes/forms/shared/RecipeStepContent';
import { groupRecipeSteps } from '@/utils/admin/recipe/groupRecipeSteps';
import { useDevice } from '@/hooks/useDevice';

interface StepsFormProps {
  recipe: AdminRecipe;
  onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
  errors: Record<string, string>;
  authoringLocale?: string;
  displayLocale?: string;
}

export function StepsForm({ recipe, onUpdateRecipe, errors, authoringLocale = 'es', displayLocale }: StepsFormProps) {
  const tForm = (key: string, opts?: any) => i18n.t(key, { ...opts, locale: authoringLocale });
  const { isMobile } = useDevice();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStep, setSelectedStep] = useState<AdminRecipeSteps | undefined>(undefined);

  // Effect to order steps by their order property
  const sortedSteps = React.useMemo(() => {
    return [...(recipe.steps || [])].sort((a, b) => a.order - b.order);
  }, [recipe.steps]);

  const handleAddStep = () => {
    // Create a new recipe step with a default order (next number in sequence)
    const newStep: AdminRecipeSteps = {
      id: generateUUID(), // Temporary ID, will be replaced on save
      order: sortedSteps.length + 1,
      translations: [
        { locale: 'es', instruction: '', recipeSection: 'Principal' },
        { locale: 'en', instruction: '', recipeSection: 'Main' },
      ],
      thermomixTime: null,
      thermomixSpeed: null,
      thermomixTemperature: null,
      thermomixTemperatureUnit: 'C',
      ingredients: []
    };
    setSelectedStep(newStep);
    setModalVisible(true);
  };

  const handleEditStep = (step: AdminRecipeSteps) => {
    setSelectedStep(step);
    setModalVisible(true);
  };

  const handleDeleteStep = (recipeStepId: string) => {
    const updatedSteps = (recipe.steps || []).filter(recipeStep => recipeStep.id !== recipeStepId);

    // Reorder remaining steps
    const reorderedSteps = updatedSteps.map((recipeStep, idx) => ({
      ...recipeStep,
      order: idx + 1
    }));

    onUpdateRecipe({ steps: reorderedSteps });
  };

  const handleSaveStep = (updatedStep: AdminRecipeSteps) => {
    let updatedSteps: AdminRecipeSteps[];

    // Check if this is a new recipeStep or updating an existing one
    const existingStepIndex = (recipe.steps || []).findIndex(recipeStep => recipeStep.id === updatedStep.id);

    if (existingStepIndex >= 0) {
      // Update existing recipeStep
      updatedSteps = [...(recipe.steps || [])];
      updatedSteps[existingStepIndex] = updatedStep;
    } else {
      // Add new recipeStep
      updatedSteps = [...(recipe.steps || []), updatedStep];
    }

    // Sort steps by order
    updatedSteps.sort((a, b) => a.order - b.order);

    onUpdateRecipe({ steps: updatedSteps });
    setModalVisible(false);
  };

  const handleMoveStepUp = (recipeStepId: string) => {
    const recipeStepIndex = sortedSteps.findIndex(recipeStep => recipeStep.id === recipeStepId);
    if (recipeStepIndex <= 0) return; // Already at the top
    const updatedSteps = [...sortedSteps];

    // Swap orders between current recipeStep and the one above it
    const currentStep = { ...updatedSteps[recipeStepIndex] };
    const prevStep = { ...updatedSteps[recipeStepIndex - 1] };
    updatedSteps[recipeStepIndex] = { ...currentStep, order: prevStep.order };
    updatedSteps[recipeStepIndex - 1] = { ...prevStep, order: currentStep.order };

    onUpdateRecipe({ steps: updatedSteps });
  };

  const handleMoveStepDown = (recipeStepId: string) => {
    const recipeStepIndex = sortedSteps.findIndex(recipeStep => recipeStep.id === recipeStepId);
    if (recipeStepIndex >= sortedSteps.length - 1) return; // Already at the bottom

    const updatedSteps = [...sortedSteps];

    // Swap orders between current recipeStep and the one below it
    const currentStep = { ...updatedSteps[recipeStepIndex] };
    const nextStep = { ...updatedSteps[recipeStepIndex + 1] };

    updatedSteps[recipeStepIndex] = { ...currentStep, order: nextStep.order };
    updatedSteps[recipeStepIndex + 1] = { ...nextStep, order: currentStep.order };

    onUpdateRecipe({ steps: updatedSteps });
  };

  const renderStepCard = (item: AdminRecipeSteps, index: number) => {
    const itemId = item.id || `temp-${Date.now()}-${index}`;

    return (
      <View key={itemId} className={`bg-background-default rounded-md overflow-hidden border border-border-default mb-md shadow-md`}>
        <View className={`flex-row items-center justify-between bg-background-secondary ${isMobile ? 'py-xxs px-xs' : 'py-xs px-sm'} border-b border-border-default`}>
          <View className={`bg-primary-default ${isMobile ? 'w-6 h-6' : 'w-7 h-7'} rounded-full items-center justify-center pt-[2px]`}>
            <Text preset="body" className={`text-text-INVERSE ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {item.order}
            </Text>
          </View>

          <View className={`flex-row ${isMobile ? 'gap-xs' : 'gap-sm'}`}>
            <TouchableOpacity
              className={`${isMobile ? 'p-xxs' : 'p-1'} rounded-sm bg-background-default ${index === 0 ? 'opacity-50' : ''}`}
              onPress={() => handleMoveStepUp(itemId)}
              disabled={index === 0}
            >
              <Ionicons name="chevron-up" size={isMobile ? 16 : 20} className={index === 0 ? 'text-text-secondary' : 'text-primary-default'} />
            </TouchableOpacity>

            <TouchableOpacity
              className={`${isMobile ? 'p-xxs' : 'p-1'} rounded-sm bg-background-default ${index === sortedSteps.length - 1 ? 'opacity-50' : ''}`}
              onPress={() => handleMoveStepDown(itemId)}
              disabled={index === sortedSteps.length - 1}
            >
              <Ionicons name="chevron-down" size={isMobile ? 16 : 20} className={index === sortedSteps.length - 1 ? 'text-text-secondary' : 'text-primary-default'} />
            </TouchableOpacity>

            <TouchableOpacity
              className={`${isMobile ? 'p-xxs' : 'p-1'} rounded-sm bg-background-default`}
              onPress={() => handleEditStep(item)}
            >
              <Ionicons name="pencil" size={isMobile ? 16 : 20} className="text-primary-DARK" />
            </TouchableOpacity>

            <TouchableOpacity
              className={`${isMobile ? 'p-xxs' : 'p-1'} rounded-sm bg-background-default`}
              onPress={() => handleDeleteStep(itemId)}
            >
              <Ionicons name="trash-outline" size={isMobile ? 16 : 20} className="text-status-error" />
            </TouchableOpacity>
          </View>
        </View>

        <RecipeStepContent
          recipeStep={item}
          displayLocale={displayLocale || authoringLocale}
        />
      </View>
    );
  };

  // Group steps by section
  const groupedSteps = React.useMemo(() => {
    return groupRecipeSteps(sortedSteps);
  }, [sortedSteps]);

  return (
    <View className="mt-lg w-full mb-md" style={{ maxWidth: 1000 }}>
      {errors.steps ? (
        <Text preset="caption" className="text-status-error mb-sm">
          {errors.steps}
        </Text>
      ) : null}

      <View className="flex-row justify-end mb-sm">
        <Button
          variant="outline"
          size="small"
          onPress={handleAddStep}
          className="self-start mb-sm"
        >
          {tForm('admin.recipes.form.stepsInfo.addStep')}
        </Button>
      </View>

      {/* Steps list */}
      {sortedSteps.length === 0 ? (
        <View className="flex-1 justify-center items-center p-lg bg-background-secondary rounded-md min-h-[200px]">
          <Ionicons name="list-outline" size={32} className="text-text-secondary" />
          <Text preset="body" className="mt-sm text-center">
            {tForm('admin.recipes.form.stepsInfo.noSteps')}
          </Text>
          <Text preset="caption" className="text-text-secondary mt-xs text-center">
            {tForm('admin.recipes.form.stepsInfo.addStepPrompt')}
          </Text>
        </View>
      ) : (
        <View>
          {Object.entries(groupedSteps).map(([sectionKey, { sectionEn, sectionEs, steps }]) => {
            const sectionName = authoringLocale.startsWith('es') ? sectionEs : sectionEn;
            return (
            <View key={sectionKey} className="mb-lg">
              <View className="mb-md pb-xs border-b border-border-default">
                <Text preset="subheading" className="mb-[2px]">
                  {sectionName}
                </Text>
              </View>
              {steps.map((item, index) => renderStepCard(item, sortedSteps.findIndex(s => s.id === item.id)))}
            </View>
            );
          })}
        </View>
      )}

      {/* Bottom Add Step Button */}
      <View className="mt-lg items-center">
        <Button
          variant="outline"
          size="small"
          onPress={handleAddStep}
          className="mb-sm"
        >
          {tForm('admin.recipes.form.stepsInfo.addStep')}
        </Button>
      </View>

      {/* Modal for editing recipeStep */}
      {selectedStep ? (
        <StepFormModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSave={handleSaveStep}
          recipeStep={selectedStep}
          recipeIngredients={recipe.ingredients || []}
          recipeSteps={recipe.steps || []}
          authoringLocale={authoringLocale}
        />
      ) : null}
    </View>
  );
}

export default StepsForm;
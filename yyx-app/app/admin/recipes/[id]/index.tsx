import React, { useState, useEffect } from 'react';
import { ScrollView, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { COLORS } from '@/constants/design-tokens';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { RecipeInfoForm } from '@/components/admin/recipes/forms/RecipeInfoForm';
import { RecipeIngredientsForm } from '@/components/admin/recipes/forms/ingredientsForm/RecipeIngredientsForm';
import { StepsForm } from '@/components/admin/recipes/forms/stepsForm/RecipeStepsForm';
import { TagsForm } from '@/components/admin/recipes/forms/tagsForm/TagsForm';
import { ReviewForm } from '@/components/admin/recipes/forms/reviewForm/ReviewForm';
import { RecipeUsefulItemsForm } from '@/components/admin/recipes/forms/usefulItemsForm/RecipeUsefulItemsForm';
import { AdminRecipe } from '@/types/recipe.admin.types';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { AlertModal } from '@/components/common/AlertModal';
import { FormErrors } from '@/components/form/FormErrors';
import { useRecipeValidation } from '@/hooks/admin/useRecipeValidation';
import i18n from '@/i18n';
import { CreateRecipeStep, RecipeProgressIndicator } from '@/components/admin/recipes/RecipeProgressIndicator';
import { NavButtons } from '@/components/form/NavButtons';
import { useRecipeNavigation } from '@/hooks/admin/useRecipeNavigation';
import { useDevice } from '@/hooks/useDevice';

export default function EditRecipePage() {
  const { id } = useLocalSearchParams();
  const [recipe, setRecipe] = useState<Partial<AdminRecipe>>({
    ingredients: [],
    steps: [],
    tags: []
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState<CreateRecipeStep>(CreateRecipeStep.BASIC_INFO);

  const { validateRecipe } = useRecipeValidation();
  const { getNextButtonLabel } = useRecipeNavigation(recipe, currentStep);
  const { isSmall } = useDevice();

  useEffect(() => {
    loadRecipe();
  }, [id]);

  const loadRecipe = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const recipeData = await adminRecipeService.getRecipeById(id as string);
      if (recipeData) {
        setRecipe(recipeData);
      }
    } catch (error) {
      console.error('Error loading recipe:', error);
      setErrors({ load: i18n.t('admin.recipes.form.errors.loadFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecipe = (updates: Partial<AdminRecipe>) => {
    setRecipe(prev => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    if (!id) return;

    // Validate before saving
    const validationErrors = validateRecipe(recipe);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setShowErrorDialog(true);
      return;
    }

    try {
      setSaving(true);
      await adminRecipeService.updateRecipe(id as string, recipe);
      setErrors({});
      setShowSuccessDialog(true);
      await loadRecipe();
    } catch (error) {
      console.error('Error saving recipe:', error);
      setErrors({ save: i18n.t('admin.recipes.form.errors.saveFailed') });
      setShowErrorDialog(true);
    } finally {
      setSaving(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep < CreateRecipeStep.REVIEW) {
      setCurrentStep(prev => (prev + 1) as CreateRecipeStep);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > CreateRecipeStep.BASIC_INFO) {
      setCurrentStep(prev => (prev - 1) as CreateRecipeStep);
    }
  };

  const handleStepClick = (step: CreateRecipeStep) => {
    setCurrentStep(step);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case CreateRecipeStep.BASIC_INFO:
        return (
          <RecipeInfoForm
            recipe={recipe}
            onUpdateRecipe={handleUpdateRecipe}
            errors={errors}
          />
        );
      case CreateRecipeStep.INGREDIENTS:
        return (
          <RecipeIngredientsForm
            recipe={recipe as AdminRecipe}
            onUpdateRecipe={handleUpdateRecipe}
            errors={errors}
          />
        );
      case CreateRecipeStep.STEPS:
        return (
          <StepsForm
            recipe={recipe as AdminRecipe}
            onUpdateRecipe={handleUpdateRecipe}
            errors={errors}
          />
        );
      case CreateRecipeStep.USEFUL_ITEMS:
        return (
          <RecipeUsefulItemsForm
            recipe={recipe as AdminRecipe}
            onUpdateRecipe={handleUpdateRecipe}
            errors={errors}
          />
        );
      case CreateRecipeStep.TAGS:
        return (
          <TagsForm
            recipe={recipe}
            onUpdateRecipe={handleUpdateRecipe}
            errors={errors}
          />
        );
      case CreateRecipeStep.REVIEW:
        return (
          <ReviewForm
            recipe={recipe}
            onUpdateRecipe={handleUpdateRecipe}
          />
        );
      default:
        return null;
    }
  };

  // Show loading state until recipe name is loaded to prevent title flash
  if (loading || !recipe.nameEn) {
    return (
      <AdminLayout title={i18n.t('admin.common.loading')} showBackButton={true}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.primary.default} />
        </View>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={recipe.nameEn ? `${recipe.nameEn} | ${recipe.nameEs}` : i18n.t('admin.recipes.form.newRecipe')}
      showBackButton={true}
    >
      <View className="flex-1">
        <ScrollView
          className="flex-1 bg-background-default"
          contentContainerStyle={{
            padding: isSmall ? 12 : 24,
            alignItems: 'center'
          }}
          nestedScrollEnabled={true}
        >
          {/* Progress Indicator - Now scrolls with content */}
          <View className={`w-full ${isSmall ? 'mb-md' : 'p-md mb-lg'} bg-background-default`}>
            <RecipeProgressIndicator
              currentStep={currentStep}
              onStepClick={handleStepClick}
              clickable={true}
            />
          </View>

          <FormErrors errors={errors} />

          {renderCurrentStep()}
        </ScrollView>

        <View className="p-md bg-background-default border-t border-border-default">
          <NavButtons
            onNext={currentStep < CreateRecipeStep.REVIEW ? handleNextStep : handleSave}
            onPrev={handlePrevStep}
            nextLabel={getNextButtonLabel()}
            prevLabel={i18n.t('common.back')}
            nextDisabled={saving}
            isLastStep={currentStep === CreateRecipeStep.REVIEW}
          />
        </View>

        {/* Success Dialog */}
        <AlertModal
          visible={showSuccessDialog}
          title={i18n.t('admin.recipes.form.saveSuccess.title')}
          message={i18n.t('admin.recipes.form.saveSuccess.message')}
          onConfirm={() => setShowSuccessDialog(false)}
          confirmText={i18n.t('common.ok')}
        />

        {/* Error Dialog */}
        <AlertModal
          visible={showErrorDialog}
          title={i18n.t('admin.recipes.form.saveError.title')}
          message={i18n.t('admin.recipes.form.saveError.message')}
          onConfirm={() => setShowErrorDialog(false)}
          confirmText={i18n.t('common.ok')}
        />
      </View>
    </AdminLayout>
  );
}

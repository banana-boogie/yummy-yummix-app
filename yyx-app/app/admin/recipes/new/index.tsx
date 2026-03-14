import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useRouter } from 'expo-router';
import i18n from '@/i18n';
import { NavButtons } from '@/components/form/NavButtons';
import { AlertModal } from '@/components/common/AlertModal';
import { FORM_MAX_WIDTH } from '@/components/form/FormSection';
import { RecipeProgressIndicator, CreateRecipeStep } from '@/components/admin/recipes/RecipeProgressIndicator';
import { ResumeDialog } from '@/components/admin/recipes/ResumeDialog';
import { useAdminRecipeForm } from '@/hooks/admin/useAdminRecipeForm';
import { AdminRecipe } from '@/types/recipe.admin.types';
import { InitialRecipeStep } from '@/components/admin/recipes/InitialRecipeStep';
import { COLORS } from '@/constants/design-tokens';
import { useRecipeNavigation } from '@/hooks/admin/useRecipeNavigation';

import {
  RecipeInfoForm,
  RecipeIngredientsForm,
  StepsForm,
  TagsForm,
  ReviewForm,
  RecipeUsefulItemsForm
} from '@/components/admin/recipes/forms';
import { TranslationStep } from '@/components/admin/recipes/forms/translationForm/TranslationStep';
import { AdminDisplayLocaleToggle } from '@/components/admin/recipes/forms/shared/AdminDisplayLocaleToggle';

// Recipe creation form with multiple steps
export default function NewRecipePage() {
  const router = useRouter();
  const [showAlert, setShowAlert] = useState(false);
  const [displayLocale, setDisplayLocale] = useState('es');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSuccess, setAlertSuccess] = useState(false);

  const {
    recipe,
    currentStep,
    errors,
    saving,
    showResumeDialog,
    savedRecipe,
    authoringLocale,
    setAuthoringLocale,
    updateRecipe,
    handleNextStep,
    handlePrevStep,
    handlePublish,
    handleResumeSavedRecipe,
    handleStartNewRecipe,
  } = useAdminRecipeForm({
    onPublishSuccess: () => {
      setAlertSuccess(true);
      setAlertMessage(i18n.t('admin.recipes.form.saveSuccess.message'));
      setShowAlert(true);
    },
    onPublishError: (message) => {
      setAlertSuccess(false);
      setAlertMessage(message);
      setShowAlert(true);
    },
  });

  const { getNextButtonLabel } = useRecipeNavigation(recipe, currentStep);

  // Render form steps based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case CreateRecipeStep.INITIAL_SETUP:
        return <InitialRecipeStep
          onUpdateRecipe={updateRecipe}
          handleNextStep={handleNextStep}
          recipe={recipe}
        />;
      case CreateRecipeStep.BASIC_INFO:
        return <RecipeInfoForm recipe={recipe} onUpdateRecipe={updateRecipe} errors={errors} authoringLocale={authoringLocale} onAuthoringLocaleChange={setAuthoringLocale} />;
      case CreateRecipeStep.USEFUL_ITEMS:
        return <RecipeUsefulItemsForm recipe={recipe as AdminRecipe} onUpdateRecipe={updateRecipe} errors={errors} authoringLocale={authoringLocale} displayLocale={displayLocale} />;
      case CreateRecipeStep.INGREDIENTS:
        return <RecipeIngredientsForm recipe={recipe as AdminRecipe} onUpdateRecipe={updateRecipe} errors={errors} authoringLocale={authoringLocale} displayLocale={displayLocale} />;
      case CreateRecipeStep.STEPS:
        return <StepsForm recipe={recipe as AdminRecipe} onUpdateRecipe={updateRecipe} errors={errors} authoringLocale={authoringLocale} displayLocale={displayLocale} />;
      case CreateRecipeStep.TAGS:
        return <TagsForm recipe={recipe} onUpdateRecipe={updateRecipe} errors={errors} displayLocale={displayLocale} />;
      case CreateRecipeStep.TRANSLATIONS:
        return <TranslationStep recipe={recipe} authoringLocale={authoringLocale} onUpdateRecipe={updateRecipe} />;
      case CreateRecipeStep.REVIEW:
        return <ReviewForm recipe={recipe} displayLocale={displayLocale} onUpdateRecipe={updateRecipe} />;
      default:
        return null;
    }
  };

  // Only show navigation
  const showNavElements = currentStep !== CreateRecipeStep.INITIAL_SETUP;

  return (
    <AdminLayout
      title={i18n.t('admin.recipes.create.title')}
      showBackButton={true}
      disableSidebar={true}
    >
      <View className="flex-1" style={{ backgroundColor: COLORS.background.default }}>
        {/* Main Content Section - Scrollable */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, alignItems: 'center' }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Section */}
            {showNavElements && (
              <View className="w-full px-md pb-md">
                <RecipeProgressIndicator currentStep={currentStep} />
                {currentStep !== CreateRecipeStep.INITIAL_SETUP && currentStep !== CreateRecipeStep.BASIC_INFO && currentStep !== CreateRecipeStep.TRANSLATIONS && (
                  <View className="mt-md">
                    <AdminDisplayLocaleToggle value={displayLocale} onChange={setDisplayLocale} />
                  </View>
                )}
              </View>
            )}
            {renderStepContent()}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer Section - Fixed at bottom */}
        {showNavElements && (
          <View className="px-lg pt-md pb-xl bg-background-default items-center shadow-md">
            <View className="w-full" style={{ maxWidth: FORM_MAX_WIDTH }}>
              <NavButtons
                onNext={currentStep < CreateRecipeStep.REVIEW ? handleNextStep : handlePublish}
                onPrev={handlePrevStep}
                nextLabel={getNextButtonLabel()}
                prevLabel={i18n.t('common.back')}
                nextDisabled={saving}
                isLastStep={currentStep === CreateRecipeStep.REVIEW}
              />
            </View>
          </View>
        )}
      </View>

      <ResumeDialog
        visible={showResumeDialog}
        savedRecipe={savedRecipe}
        onResume={handleResumeSavedRecipe}
        onStartNew={handleStartNewRecipe}
      />

      <AlertModal
        visible={showAlert}
        title={alertSuccess ? i18n.t('admin.recipes.form.saveSuccess.title') : i18n.t('admin.recipes.form.saveError.title')}
        message={alertMessage}
        onConfirm={() => {
          setShowAlert(false);
          if (alertSuccess) {
            router.back();
          }
        }}
        confirmText={i18n.t('common.ok')}
      />
    </AdminLayout>
  );
}

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
  RecipeKitchenToolsForm,
  MyWeekSetupForm
} from '@/components/admin/recipes/forms';
import { TranslationStep } from '@/components/admin/recipes/forms/translationForm/TranslationStep';
import { AdminDisplayLocaleToggle } from '@/components/admin/recipes/forms/shared/AdminDisplayLocaleToggle';

// Recipe creation form with multiple steps
export default function NewRecipePage() {
  const router = useRouter();
  const [showAlert, setShowAlert] = useState(false);
  const [displayLocale, setDisplayLocale] = useState(i18n.locale);
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
    setCurrentStep,
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
      case CreateRecipeStep.KITCHEN_TOOLS:
        return <RecipeKitchenToolsForm recipe={recipe as AdminRecipe} onUpdateRecipe={updateRecipe} errors={errors} authoringLocale={authoringLocale} displayLocale={displayLocale} missingKitchenTools={recipe._missingKitchenTools} />;
      case CreateRecipeStep.INGREDIENTS:
        return <RecipeIngredientsForm recipe={recipe as AdminRecipe} onUpdateRecipe={updateRecipe} errors={errors} authoringLocale={authoringLocale} displayLocale={displayLocale} missingIngredients={recipe._missingIngredients} />;
      case CreateRecipeStep.STEPS:
        return <StepsForm recipe={recipe as AdminRecipe} onUpdateRecipe={updateRecipe} errors={errors} authoringLocale={authoringLocale} displayLocale={displayLocale} />;
      case CreateRecipeStep.TAGS:
        return <TagsForm recipe={recipe} onUpdateRecipe={updateRecipe} errors={errors} displayLocale={displayLocale} />;
      case CreateRecipeStep.MY_WEEK_SETUP:
        return <MyWeekSetupForm recipe={recipe} onUpdateRecipe={updateRecipe} displayLocale={displayLocale} />;
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
          {(() => {
            const isPickerStep = currentStep === CreateRecipeStep.KITCHEN_TOOLS || currentStep === CreateRecipeStep.INGREDIENTS;
            const header = showNavElements ? (
              <View className={`w-full px-md ${isPickerStep ? 'pb-xs' : 'pb-md'}`}>
                <RecipeProgressIndicator currentStep={currentStep} onStepClick={setCurrentStep} clickable={true} />
                {currentStep !== CreateRecipeStep.INITIAL_SETUP && currentStep !== CreateRecipeStep.TRANSLATIONS && (
                  <View className={isPickerStep ? 'mt-xs' : 'mt-md'}>
                    <AdminDisplayLocaleToggle
                      value={currentStep === CreateRecipeStep.BASIC_INFO ? authoringLocale : displayLocale}
                      onChange={(locale) => {
                        if (currentStep === CreateRecipeStep.BASIC_INFO) {
                          setAuthoringLocale(locale);
                        }
                        setDisplayLocale(locale);
                      }}
                    />
                  </View>
                )}
              </View>
            ) : null;

            if (isPickerStep) {
              return (
                <ScrollView
                  className="flex-1"
                  contentContainerClassName="p-lg flex-grow"
                  keyboardShouldPersistTaps="handled"
                >
                  {header}
                  {renderStepContent()}
                </ScrollView>
              );
            }

            // Other steps: scrollable
            return (
              <ScrollView
                className="flex-1"
                contentContainerClassName="p-lg flex-grow"
                keyboardShouldPersistTaps="handled"
              >
                {header}
                {renderStepContent()}
              </ScrollView>
            );
          })()}
        </KeyboardAvoidingView>

        {/* Footer Section - Fixed at bottom */}
        {showNavElements && (
          <View className="px-lg pt-sm pb-md bg-background-default border-t border-grey-light">
            <View className="w-full">
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
            router.replace('/admin/recipes');
          }
        }}
        confirmText={i18n.t('common.ok')}
      />
    </AdminLayout>
  );
}

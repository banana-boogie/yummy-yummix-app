import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdminRecipe, getTranslatedField } from '@/types/recipe.admin.types';
import { CreateRecipeStep } from '@/components/admin/recipes/RecipeProgressIndicator';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { imageService } from '@/services/storage/imageService';
import { normalizeFileName } from '@/utils/formatters';
import { useRecipeValidation } from './useRecipeValidation';
import { loadAuthoringLocale, saveAuthoringLocale } from '@/components/admin/recipes/forms/shared/AuthoringLanguagePicker';
import i18n from '@/i18n';
import logger from '@/services/logger';

// Storage keys
const STORAGE_KEYS = {
  DRAFT_RECIPE: 'draft_recipe',
  CURRENT_STEP: 'recipe_form_step',
  DRAFT_SCHEMA_VERSION: 'recipe_form_schema_version',
};

// Bump this when the step enum order changes so that older drafts get migrated.
// v1 = pre-planner (TRANSLATIONS=6, REVIEW=7)
// v2 = planner inserted (MY_WEEK_SETUP=6, TRANSLATIONS=7, REVIEW=8)
const DRAFT_SCHEMA_VERSION = 2;

/**
 * Migrate a raw persisted step value (unknown schema version) to the current enum.
 * For v1 → v2: TRANSLATIONS/REVIEW shifted by +1 because MY_WEEK_SETUP was inserted at 6.
 */
export function migrateDraftStep(rawStep: number, fromVersion: number): CreateRecipeStep {
  const maxStep = CreateRecipeStep.REVIEW;
  if (!Number.isFinite(rawStep) || rawStep < 0) return CreateRecipeStep.INITIAL_SETUP;

  let step = rawStep;
  if (fromVersion < 2) {
    // Old: TRANSLATIONS=6, REVIEW=7 → New: TRANSLATIONS=7, REVIEW=8
    if (step === 6 || step === 7) step = step + 1;
  }

  if (step > maxStep) return CreateRecipeStep.INITIAL_SETUP;
  return step as CreateRecipeStep;
}

// Extended recipe type that includes the image file for upload
export interface ExtendedRecipe extends Partial<AdminRecipe> {
  _imageFile?: any;
  _imageFileUri?: string;
  _missingIngredients?: any[];
  _missingKitchenTools?: any[];
}

// Initial recipe state - only the authoring locale's translation
function createInitialRecipeState(authoringLocale: string): ExtendedRecipe {
  return {
  translations: [
    { locale: authoringLocale, name: '' },
  ],
  difficulty: undefined,
  prepTime: undefined,
  totalTime: undefined,
  portions: undefined,
  pictureUrl: '',
  ingredients: [],
  tags: [],
  steps: [],
  kitchenTools: [],
  isPublished: false,
  };
}

interface UseAdminRecipeFormProps {
  onPublishSuccess: () => void;
  onPublishError: (message: string) => void;
}

interface UseAdminRecipeFormReturn {
  recipe: ExtendedRecipe;
  currentStep: CreateRecipeStep;
  errors: Record<string, string>;
  saving: boolean;
  isLoaded: boolean;
  showResumeDialog: boolean;
  savedRecipe: ExtendedRecipe | null;
  authoringLocale: string;
  setAuthoringLocale: (locale: string) => void;
  updateRecipe: (updates: Partial<ExtendedRecipe>) => void;
  handleNextStep: () => void;
  handlePrevStep: () => void;
  handlePublish: () => Promise<void>;
  handleResumeSavedRecipe: () => void;
  handleStartNewRecipe: () => Promise<void>;
}

export function useAdminRecipeForm({ onPublishSuccess, onPublishError }: UseAdminRecipeFormProps): UseAdminRecipeFormReturn {
  const [authoringLocale, setAuthoringLocaleState] = useState(i18n.locale);
  const [currentStep, setCurrentStep] = useState<CreateRecipeStep>(CreateRecipeStep.INITIAL_SETUP);
  const [recipe, setRecipe] = useState<ExtendedRecipe>(createInitialRecipeState(i18n.locale));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [savedRecipe, setSavedRecipe] = useState<ExtendedRecipe | null>(null);

  const { validateBasicInfo, validateIngredients, validateSteps, validateTags } = useRecipeValidation();

  // Load authoring locale on mount
  useEffect(() => {
    loadAuthoringLocale().then(locale => {
      setAuthoringLocaleState(locale);
      setRecipe(createInitialRecipeState(locale));
    });
  }, []);

  const setAuthoringLocale = useCallback((locale: string) => {
    setAuthoringLocaleState(locale);
    saveAuthoringLocale(locale);
  }, []);

  // Load saved data on component mount
  useEffect(() => {
    checkForSavedRecipe();
  }, []);

  // Save data whenever recipe or currentStep changes
  useEffect(() => {
    if (isLoaded) {
      saveCurrentData();
    }
  }, [recipe, currentStep, isLoaded]);

  // Check if there's a saved recipe and show resume dialog
  const checkForSavedRecipe = async () => {
    try {
      let savedRecipeData = null;
      
      // For web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const savedRecipeStr = localStorage.getItem(STORAGE_KEYS.DRAFT_RECIPE);
        
        if (savedRecipeStr) {
          savedRecipeData = JSON.parse(savedRecipeStr);
        }
      } 
      // For mobile
      else {
        const savedRecipeStr = await AsyncStorage.getItem(STORAGE_KEYS.DRAFT_RECIPE);
        
        if (savedRecipeStr) {
          savedRecipeData = JSON.parse(savedRecipeStr);
        }
      }
      
      // If there's a saved recipe, show the resume dialog
      const savedNameEn = getTranslatedField(savedRecipeData?.translations, 'en', 'name');
      const savedNameEs = getTranslatedField(savedRecipeData?.translations, 'es', 'name');
      if (savedRecipeData && (savedNameEn || savedNameEs)) {
        setSavedRecipe(savedRecipeData);
        setShowResumeDialog(true);
      } else {
        // No saved recipe or not enough info, just load any data we have
        loadSavedData();
      }
    } catch (error) {
      logger.error('Error checking for saved recipe:', error);
      loadSavedData(); // Fallback to normal loading
    }
  };

  // Load saved draft and step from storage
  const loadSavedData = async () => {
    try {
      // For web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const savedRecipeStr = localStorage.getItem(STORAGE_KEYS.DRAFT_RECIPE);
        const savedStep = parseInt(localStorage.getItem(STORAGE_KEYS.CURRENT_STEP) || '0');
        const savedVersion = parseInt(
          localStorage.getItem(STORAGE_KEYS.DRAFT_SCHEMA_VERSION) || '1',
        );
        let savedRecipe = null;
        if (savedRecipeStr) {
          savedRecipe = JSON.parse(savedRecipeStr);
          restoreRecipeData(savedRecipe);
        }

        if (savedStep) {
          const migrated = migrateDraftStep(savedStep, savedVersion);
          // Special case: recipe was saved at initial setup after populated with AI help.
          // We should start at step 1 in this case, otherwise the user would get stuck at step 0.
          const loadedNameEn = getTranslatedField(savedRecipe?.translations, 'en', 'name');
          const loadedNameEs = getTranslatedField(savedRecipe?.translations, 'es', 'name');
          if (savedRecipe && (loadedNameEn || loadedNameEs)) {
            setCurrentStep(Math.max(migrated, 1) as CreateRecipeStep);
          } else {
            setCurrentStep(migrated);
          }
        }
      }
      // For mobile
      else {
        const savedRecipeStr = await AsyncStorage.getItem(STORAGE_KEYS.DRAFT_RECIPE);
        const savedStep = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_STEP);
        const savedVersion = parseInt(
          (await AsyncStorage.getItem(STORAGE_KEYS.DRAFT_SCHEMA_VERSION)) || '1',
        );

        if (savedRecipeStr) {
          const savedRecipe = JSON.parse(savedRecipeStr);
          restoreRecipeData(savedRecipe);
        }

        if (savedStep) {
          setCurrentStep(migrateDraftStep(parseInt(savedStep), savedVersion));
        }
      }
    } catch (error) {
      logger.error('Error loading saved data:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  // Restore recipe data including image file
  const restoreRecipeData = (savedRecipe: ExtendedRecipe) => {
    // Restore image file if we have a URI
    if (savedRecipe.pictureUrl && !savedRecipe._imageFile) {
      const filename = savedRecipe.pictureUrl.split('/').pop() || 'recipe.jpg';
      
      savedRecipe._imageFile = {
        uri: savedRecipe.pictureUrl,
        name: filename,
        type: 'image/jpeg'
      };
    }
    
    setRecipe(savedRecipe);
  };

  // Save current data to storage
  const saveCurrentData = async () => {
    try {
      // Don't save if we're publishing
      if (saving) return;
      
      const recipeToSave = { ...recipe };
      
      // Handle the image file (we can't stringify the actual file object)
      if (recipeToSave._imageFile) {
        // Just save the URI for persistence
        recipeToSave._imageFileUri = recipeToSave._imageFile.uri as string;
        // Keep the pictureUrl field consistent with the file URI
        if (recipeToSave.pictureUrl !== recipeToSave._imageFileUri) {
          recipeToSave.pictureUrl = recipeToSave._imageFileUri;
        }
        // Remove the actual file object since it cannot be stringified
        delete recipeToSave._imageFile;
      }
      
      // For web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.DRAFT_RECIPE, JSON.stringify(recipeToSave));
        localStorage.setItem(STORAGE_KEYS.CURRENT_STEP, currentStep.toString());
        localStorage.setItem(STORAGE_KEYS.DRAFT_SCHEMA_VERSION, DRAFT_SCHEMA_VERSION.toString());
      }
      // For mobile
      else {
        await AsyncStorage.setItem(STORAGE_KEYS.DRAFT_RECIPE, JSON.stringify(recipeToSave));
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_STEP, currentStep.toString());
        await AsyncStorage.setItem(STORAGE_KEYS.DRAFT_SCHEMA_VERSION, DRAFT_SCHEMA_VERSION.toString());
      }
    } catch (error) {
      logger.error('Error saving data:', error);
    }
  };

  // Clear saved data
  const clearSavedData = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.DRAFT_RECIPE);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
        localStorage.removeItem(STORAGE_KEYS.DRAFT_SCHEMA_VERSION);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_RECIPE);
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
        await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_SCHEMA_VERSION);
      }
    } catch (error) {
      logger.error('Error clearing saved data:', error);
    }
  };

  // Update recipe state
  const updateRecipe = useCallback((updates: Partial<ExtendedRecipe>) => {
    setRecipe(prev => ({ ...prev, ...updates }));
  }, []);

  // Validate the current step
  const validateCurrentStep = (): boolean => {
    let newErrors: Record<string, string> = {};
    
    switch (currentStep) {
      case CreateRecipeStep.BASIC_INFO:
        newErrors = validateBasicInfo(recipe);
        break;
        
      case CreateRecipeStep.INGREDIENTS:
        newErrors = validateIngredients(recipe);
        break;
        
      case CreateRecipeStep.STEPS:
        newErrors = validateSteps(recipe);
        break;

      case CreateRecipeStep.TAGS:
        newErrors = validateTags(recipe);
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Move to the next step
  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prevStep => (prevStep + 1) as CreateRecipeStep);
    }
  };

  // Move to the previous step
  const handlePrevStep = () => {
    setCurrentStep(prevStep => (prevStep - 1) as CreateRecipeStep);
  };

  // Handle publishing the recipe
  const handlePublish = async () => {
    try {
      setSaving(true);
            
      // Upload image if new image file is provided
      let finalPictureUrl = recipe.pictureUrl || '';
      if (recipe._imageFile && recipe.pictureUrl && typeof recipe.pictureUrl === 'string' && !recipe.pictureUrl.startsWith('http')) {
        const recipeNameEs = getTranslatedField(recipe.translations, 'es', 'name');
        const recipeNameEn = getTranslatedField(recipe.translations, 'en', 'name');
        const fileName = normalizeFileName(recipeNameEs || recipeNameEn || 'recipe');
        finalPictureUrl = await imageService.uploadImage({
          bucket: 'recipes',
          folderPath: 'images',
          fileName,
          file: recipe._imageFile
        });
      }
      
      // Prepare recipe data for saving
      const recipeData: Partial<AdminRecipe> = {
        translations: recipe.translations,
        pictureUrl: finalPictureUrl,
        difficulty: recipe.difficulty,
        prepTime: recipe.prepTime,
        totalTime: recipe.totalTime,
        portions: recipe.portions,
        isPublished: recipe.isPublished ?? true,
        ingredients: recipe.ingredients,
        tags: recipe.tags,
        steps: recipe.steps,
        kitchenTools: recipe.kitchenTools,
        // My Week Setup planner metadata
        plannerRole: recipe.plannerRole,
        alternatePlannerRoles: recipe.alternatePlannerRoles,
        mealComponents: recipe.mealComponents,
        isCompleteMeal: recipe.isCompleteMeal,
        equipmentTags: recipe.equipmentTags,
        cookingLevel: recipe.cookingLevel,
        leftoversFriendly: recipe.leftoversFriendly,
        batchFriendly: recipe.batchFriendly,
        maxHouseholdSizeSupported: recipe.maxHouseholdSizeSupported,
        requiresMultiBatchNote: recipe.requiresMultiBatchNote,
        verifiedAt: recipe.verifiedAt,
        verifiedBy: recipe.verifiedBy,
      };
      
      // Create the recipe
      const recipeId = await adminRecipeService.createRecipe(recipeData);
      if (!recipeId) {
        throw new Error('Failed to create recipe');
      }

      // Clear the saved draft after successful publish
      await clearSavedData();
      onPublishSuccess();
    } catch (error) {
      logger.error('Error publishing recipe:', error);
      onPublishError(i18n.t('admin.recipes.errors.publishFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Handle resuming saved recipe
  const handleResumeSavedRecipe = () => {
    setShowResumeDialog(false);
    loadSavedData();
  };

  // Handle starting new recipe
  const handleStartNewRecipe = async () => {
    setShowResumeDialog(false);
    await clearSavedData();
    setRecipe(createInitialRecipeState(authoringLocale));
    setCurrentStep(CreateRecipeStep.INITIAL_SETUP);
    setIsLoaded(true);
  };

  return {
    recipe,
    currentStep,
    errors,
    saving,
    isLoaded,
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
  };
} 
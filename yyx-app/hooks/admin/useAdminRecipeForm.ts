import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdminRecipe } from '@/types/recipe.admin.types';
import { CreateRecipeStep } from '@/components/admin/recipes/RecipeProgressIndicator';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { imageService } from '@/services/storage/imageService';
import { normalizeFileName } from '@/utils/formatters';
import { useRecipeValidation } from './useRecipeValidation';
import i18n from '@/i18n';

// Storage keys
const STORAGE_KEYS = {
  DRAFT_RECIPE: 'draft_recipe',
  CURRENT_STEP: 'recipe_form_step'
};

// Extended recipe type that includes the image file for upload
export interface ExtendedRecipe extends Partial<AdminRecipe> {
  _imageFile?: any;
  _imageFileUri?: string;
}

// Initial recipe state
const initialRecipeState: ExtendedRecipe = {
  nameEn: '',
  nameEs: '',
  difficulty: undefined,
  prepTime: undefined,
  totalTime: undefined,
  portions: undefined,
  tipsAndTricksEn: '',
  tipsAndTricksEs: '',
  pictureUrl: '',
  ingredients: [],
  tags: [],
  steps: [],
  usefulItems: [],
  isPublished: false,
};

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
  updateRecipe: (updates: Partial<ExtendedRecipe>) => void;
  handleNextStep: () => void;
  handlePrevStep: () => void;
  handlePublish: () => Promise<void>;
  handleResumeSavedRecipe: () => void;
  handleStartNewRecipe: () => Promise<void>;
}

export function useAdminRecipeForm({ onPublishSuccess, onPublishError }: UseAdminRecipeFormProps): UseAdminRecipeFormReturn {
  const [currentStep, setCurrentStep] = useState<CreateRecipeStep>(CreateRecipeStep.INITIAL_SETUP);
  const [recipe, setRecipe] = useState<ExtendedRecipe>(initialRecipeState);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [savedRecipe, setSavedRecipe] = useState<ExtendedRecipe | null>(null);

  const { validateBasicInfo, validateIngredients, validateSteps, validateTags } = useRecipeValidation();

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
      if (savedRecipeData && (savedRecipeData.nameEn || savedRecipeData.nameEs)) {
        setSavedRecipe(savedRecipeData);
        setShowResumeDialog(true);
      } else {
        // No saved recipe or not enough info, just load any data we have
        loadSavedData();
      }
    } catch (error) {
      console.error('Error checking for saved recipe:', error);
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
        let savedRecipe = null;
        if (savedRecipeStr) {
          savedRecipe = JSON.parse(savedRecipeStr);
          restoreRecipeData(savedRecipe);
        }

        if (savedStep) {
          // Special case: recipe was saved at initial setup after populated with AI help.
          // We should start at step 1 in this case, otherwise the user would get stuck at step 0.
          if (savedRecipe && (savedRecipe?.nameEn || savedRecipe?.nameEs)) {
            setCurrentStep(Math.max(savedStep, 1) as CreateRecipeStep);
          } else {
            setCurrentStep(savedStep as CreateRecipeStep);
          }
        }
      } 
      // For mobile
      else {
        const savedRecipeStr = await AsyncStorage.getItem(STORAGE_KEYS.DRAFT_RECIPE);
        const savedStep = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_STEP);
        
        if (savedRecipeStr) {
          const savedRecipe = JSON.parse(savedRecipeStr);
          restoreRecipeData(savedRecipe);
        }
        
        if (savedStep) {
          setCurrentStep(parseInt(savedStep) as CreateRecipeStep);
        }
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
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
      } 
      // For mobile
      else {
        await AsyncStorage.setItem(STORAGE_KEYS.DRAFT_RECIPE, JSON.stringify(recipeToSave));
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_STEP, currentStep.toString());
      }
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // Clear saved data
  const clearSavedData = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.DRAFT_RECIPE);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.DRAFT_RECIPE);
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_STEP);
      }
    } catch (error) {
      console.error('Error clearing saved data:', error);
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
        const fileName = normalizeFileName(recipe.nameEs || recipe.nameEn || 'recipe');
        finalPictureUrl = await imageService.uploadImage({
          bucket: 'recipes',
          folderPath: 'images',
          fileName,
          file: recipe._imageFile
        });
      }
      
      // Prepare recipe data for saving
      const recipeData: Partial<AdminRecipe> = {
        nameEn: recipe.nameEn,
        nameEs: recipe.nameEs,
        pictureUrl: finalPictureUrl,
        difficulty: recipe.difficulty,
        prepTime: recipe.prepTime,
        totalTime: recipe.totalTime,
        portions: recipe.portions,
        tipsAndTricksEn: recipe.tipsAndTricksEn,
        tipsAndTricksEs: recipe.tipsAndTricksEs,
        isPublished: recipe.isPublished ?? true,
        ingredients: recipe.ingredients,
        tags: recipe.tags,
        steps: recipe.steps,
        usefulItems: recipe.usefulItems,
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
      console.error('Error publishing recipe:', error);
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
    setRecipe(initialRecipeState);
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
    updateRecipe,
    handleNextStep,
    handlePrevStep,
    handlePublish,
    handleResumeSavedRecipe,
    handleStartNewRecipe,
  };
} 
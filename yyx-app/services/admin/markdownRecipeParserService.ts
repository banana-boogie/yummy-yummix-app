import { v4 as generateUUID } from 'uuid';
import {
  AdminIngredient,
  AdminMeasurementUnit,
  AdminRecipe,
  AdminRecipeIngredient,
  AdminRecipeStepIngredient,
  AdminRecipeSteps,
  AdminRecipeTag,
  AdminRecipeUsefulItem,
  AdminUsefulItem,
  getTranslatedField,
} from '@/types/recipe.admin.types';
import { supabase } from 'lib/supabase'
import { RecipeDifficulty } from '@/types/recipe.types';
import { adminIngredientsService } from './adminIngredientsService';
import { adminRecipeTagService } from './adminRecipeTagService';
import adminRecipeService from './adminRecipeService';
import { defaultMatcher as ingredientMatcher } from '@/utils/ingredients/ingredientMatcher';
import { adminUsefulItemsService } from './adminUsefulItemsService';

interface ParseRecipeResult {
  recipe: Partial<AdminRecipe>;
  missingIngredients: AdminRecipeIngredient[];
  missingTags: string[];
  missingUsefulItems: string[];
}

// March measurement unit from database
const matchMeasurementUnit = (unitID: string, allMeasurements: AdminMeasurementUnit[]): AdminMeasurementUnit | undefined=> {
  const match = allMeasurements.find(
    unit =>
      unit.id?.toLowerCase() === unitID
  );
  return match
}

// Match tag from database
const matchTag = (tagName: string, allTags: AdminRecipeTag[]): AdminRecipeTag | null => {
  // Remove the # prefix if present
  const normalizedTagName = tagName.startsWith('#') ? tagName.substring(1) : tagName;

  const match = allTags.find(tag => {
    const tagNameEn = getTranslatedField(tag.translations, 'en', 'name');
    const tagNameEs = getTranslatedField(tag.translations, 'es', 'name');
    return tagNameEn.toLowerCase() === normalizedTagName.toLowerCase() ||
      tagNameEs.toLowerCase() === normalizedTagName.toLowerCase();
  });

  if (!match) return null;

  return match;
};

// Process ingredients into AdminRecipeIngredient objects
const processIngredients = (
  parsedIngredients: any[],
  allIngredients: AdminIngredient[],
  allMeasurementUnits: AdminMeasurementUnit[]
): { ingredients: AdminRecipeIngredient[], missingIngredients: any[] } => {
  const ingredients: AdminRecipeIngredient[] = [];
  const missingIngredients: any[] = [];

  let order = 0;
  for (const item of parsedIngredients) {
    const ingredientMatch = ingredientMatcher.findMatch(item, allIngredients) as AdminIngredient;

    if (ingredientMatch) {
      const measurementUnitMatch = matchMeasurementUnit(item.measurementUnitID, allMeasurementUnits) as AdminMeasurementUnit;
      ingredients.push({
        id: `temp-${generateUUID()}`, // temp id
        ingredientId: ingredientMatch.id,
        ingredient: ingredientMatch,
        measurementUnit: measurementUnitMatch,
        translations: item.translations || [],
        displayOrder: item.displayOrder || order,
        quantity: item.quantity,
        optional: item.optional || false,
      });

      order++;
    } else {
      missingIngredients.push(item);
    }

  }

  return { ingredients, missingIngredients };
};

// Process tags into AdminRecipeTag objects
const processTags = (
  tagNames: string[],
  allTags: any[]
): { tags: AdminRecipeTag[], missingTags: string[] } => {
  // Create a Map to handle deduplication automatically
  const tagMap = new Map<string, AdminRecipeTag>();
  const missingTags: string[] = [];

  // Process all tag names
  tagNames.forEach(tagName => {
    const tagMatch = matchTag(tagName, allTags);

    if (tagMatch) {
      tagMap.set(tagMatch.id, tagMatch);
    } else if (!missingTags.includes(tagName)) {
      missingTags.push(tagName);
    }
  });

  // Convert the Map values back to an array
  const tags = Array.from(tagMap.values());

  return { tags, missingTags };
};


const processSteps = (steps: AdminRecipeSteps[], allIngredients: AdminRecipeIngredient[]): AdminRecipeSteps[] => {
  return steps.map((recipeStep) => {
    const recipeStepIngredients = recipeStep.ingredients?.map((recipeStepIngredient: AdminRecipeStepIngredient) => {


      const matchedIngredient = ingredientMatcher.findMatch(recipeStepIngredient, allIngredients);
      if (matchedIngredient) {
        return {
          ...recipeStepIngredient,
          ...matchedIngredient
        }
      }
      return null;
    })
      .filter((ingredient) => ingredient !== null) || [];
    return {
      ...recipeStep,
      id: `temp-${generateUUID()}`, // Ensure steps have IDs
      ingredients: recipeStepIngredients
    }
  });
};

/**
 * Process useful items into AdminRecipeUsefulItem objects
 * @param usefulItemsNames - Array of useful item names
 * @param allUsefulItems - Array of all useful items
 * @returns - Object containing processed useful items and missing useful items
 */
const processUsefulItems = (usefulItemsNames: AdminUsefulItem[], allUsefulItems: AdminUsefulItem[]): { usefulItems: AdminRecipeUsefulItem[], missingUsefulItems: string[] } => {
  const matchUsefulItem = (usefulItem: AdminUsefulItem, allUsefulItems: AdminUsefulItem[]): AdminUsefulItem | null => {
    // The parsed usefulItem may use old nameEn/nameEs or translations
    const searchNameEn = getTranslatedField(usefulItem.translations, 'en', 'name') || (usefulItem as any).nameEn || '';
    const searchNameEs = getTranslatedField(usefulItem.translations, 'es', 'name') || (usefulItem as any).nameEs || '';
    const match = allUsefulItems.find(item => {
      const itemNameEn = getTranslatedField(item.translations, 'en', 'name');
      const itemNameEs = getTranslatedField(item.translations, 'es', 'name');
      return itemNameEn.toLowerCase().trim() === searchNameEn.toLowerCase().trim() ||
        itemNameEs.toLowerCase().trim() === searchNameEs.toLowerCase().trim();
    });
    return match || null;
  }

  const usefulItemsMap: Map<string, AdminRecipeUsefulItem> = new Map();
  const missingUsefulItems: string[] = [];

  for (const [index, usefulItem] of usefulItemsNames.entries()) {
    const matchedUsefulItem = matchUsefulItem(usefulItem, allUsefulItems);
    if (matchedUsefulItem) {
      // Extract notes translations from the parsed useful item
      const noteTranslations = (usefulItem as any).translations?.map((t: any) => ({
        locale: t.locale,
        notes: t.notes || '',
      })) || [];
      usefulItemsMap.set(matchedUsefulItem.id, {
        id: `temp-${generateUUID()}`,
        recipeId: `temp-recipe-id`,
        usefulItemId: matchedUsefulItem.id,
        // @ts-ignore - displayOrder should exist in markdown data
        displayOrder: usefulItem.displayOrder || index,
        translations: noteTranslations,
        usefulItem: matchedUsefulItem
      });
    } else {
      const nameEn = getTranslatedField(usefulItem.translations, 'en', 'name') || (usefulItem as any).nameEn || '';
      missingUsefulItems.push(nameEn);
    }
  }

  return { usefulItems: Array.from(usefulItemsMap.values()), missingUsefulItems };
}

export const parseRecipeMarkdown = async (markdown: string): Promise<ParseRecipeResult> => {
  try {
    const [allIngredients, allTags, allMeasurementUnits, allUsefulItems] = await Promise.all([
      adminIngredientsService.getAllIngredientsForAdmin(),
      adminRecipeTagService.getAllTags(),
      adminRecipeService.getAllMeasurementUnits(),
      adminUsefulItemsService.getAllUsefulItems()
    ]);

    const { data: responseData, error } = await supabase.functions.invoke('parse-recipe-markdown', {
      body: { markdown },
    });

    if (error) {
      throw new Error(`Failed to parse recipe.`);
    }
    const data = JSON.parse(responseData)
    

    // Process the parsed data into AdminRecipe format
    const recipe: Partial<AdminRecipe> = {
      translations: data.translations || [],
      totalTime: data.totalTime,
      prepTime: data.prepTime,
      difficulty: data.difficulty as RecipeDifficulty,
      portions: data.portions,
    };
    
    // Process ingredients
    const { ingredients, missingIngredients } = processIngredients(data.ingredients, allIngredients, allMeasurementUnits);
    recipe.ingredients = ingredients;

    
    // Process tags
    const { tags, missingTags } = processTags(data.tags, allTags);
    recipe.tags = tags;
    
    // Use the processed ingredients as the data source for finding ingredients used in the instruction
    recipe.steps = processSteps(data.steps, ingredients)

    // Process useful items
    const { usefulItems, missingUsefulItems } = processUsefulItems(data.usefulItems, allUsefulItems);
    recipe.usefulItems = usefulItems;


    return {
      recipe,
      missingIngredients,
      missingTags,
      missingUsefulItems
    };
  } catch (error) {
    throw new Error(`Failed to parse recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 
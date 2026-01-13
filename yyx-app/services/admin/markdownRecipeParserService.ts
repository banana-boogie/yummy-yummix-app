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

  const match = allTags.find(
    tag =>
      tag.nameEn.toLowerCase() === normalizedTagName.toLowerCase() ||
      tag.nameEs.toLowerCase() === normalizedTagName.toLowerCase()
  );

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
        recipeSectionEn: item.recipeSectionEn || 'Main',
        recipeSectionEs: item.recipeSectionEs || 'Principal',
        displayOrder: item.displayOrder || order,
        quantity: item.quantity,
        optional: item.optional || false,
        notesEn: item.notesEn || '',
        notesEs: item.notesEs || '',
        tipEn: item.tipEn || '',
        tipEs: item.tipEs || ''
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
    const match = allUsefulItems.find(
      item => item.nameEn.toLowerCase().trim() === usefulItem.nameEn.toLowerCase().trim() || item.nameEs.toLowerCase().trim() === usefulItem.nameEs.toLowerCase().trim()
    );
    return match || null;
  }

  const usefulItemsMap: Map<string, AdminRecipeUsefulItem> = new Map();
  const missingUsefulItems: string[] = [];

  for (const [index, usefulItem] of usefulItemsNames.entries()) {
    const matchedUsefulItem = matchUsefulItem(usefulItem, allUsefulItems);
    if (matchedUsefulItem) {
      usefulItemsMap.set(matchedUsefulItem.id, {
        id: `temp-${generateUUID()}`, // Ensure recipeUsefulItem has an id
        recipeId: `temp-recipe-id`, // Ensure recipeUsefulItem has a recipeId
        usefulItemId: matchedUsefulItem.id,
        // @ts-ignore - displayOrder should exist in markdown data
        displayOrder: usefulItem.displayOrder || index,
        // @ts-ignore - Include notes if they exist in the parsed data
        notesEn: usefulItem.notesEn || '',
        // @ts-ignore - Include notes if they exist in the parsed data
        notesEs: usefulItem.notesEs || '',
        usefulItem: matchedUsefulItem
      });
    } else {
      missingUsefulItems.push(usefulItem.nameEn);
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
      nameEn: data.nameEn,
      nameEs: data.nameEs,
      totalTime: data.totalTime,
      prepTime: data.prepTime,
      difficulty: data.difficulty as RecipeDifficulty,
      portions: data.portions,
      tipsAndTricksEn: data.tipsAndTricksEn,
      tipsAndTricksEs: data.tipsAndTricksEs,
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
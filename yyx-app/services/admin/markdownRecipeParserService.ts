import { v4 as generateUUID } from 'uuid';
import {
  AdminIngredient,
  AdminMeasurementUnit,
  AdminRecipe,
  AdminRecipeIngredient,
  AdminRecipeStepIngredient,
  AdminRecipeSteps,
  AdminRecipeTag,
  AdminRecipeKitchenTool,
  AdminKitchenTool,
  getTranslatedField,
} from '@/types/recipe.admin.types';
import { supabase } from 'lib/supabase'
import { RecipeDifficulty } from '@/types/recipe.types';
import { adminIngredientsService } from './adminIngredientsService';
import { adminRecipeTagService } from './adminRecipeTagService';
import adminRecipeService from './adminRecipeService';
import { defaultMatcher as ingredientMatcher } from '@/utils/ingredients/ingredientMatcher';
import { adminKitchenToolsService } from './adminKitchenToolsService';

interface ParseRecipeResult {
  recipe: Partial<AdminRecipe>;
  missingIngredients: AdminRecipeIngredient[];
  missingTags: string[];
  missingKitchenTools: string[];
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
 * Process kitchen tools into AdminRecipeKitchenTool objects
 * @param kitchenToolNames - Array of kitchen tool names
 * @param allKitchenTools - Array of all kitchen tools
 * @returns - Object containing processed kitchen tools and missing kitchen tools
 */
const processKitchenTools = (kitchenToolNames: AdminKitchenTool[], allKitchenTools: AdminKitchenTool[]): { kitchenTools: AdminRecipeKitchenTool[], missingKitchenTools: string[] } => {
  const matchKitchenTool = (kitchenTool: AdminKitchenTool, allKitchenTools: AdminKitchenTool[]): AdminKitchenTool | null => {
    const searchNameEn = getTranslatedField(kitchenTool.translations, 'en', 'name');
    const searchNameEs = getTranslatedField(kitchenTool.translations, 'es', 'name');
    const match = allKitchenTools.find(item => {
      const itemNameEn = getTranslatedField(item.translations, 'en', 'name');
      const itemNameEs = getTranslatedField(item.translations, 'es', 'name');
      return itemNameEn.toLowerCase().trim() === searchNameEn.toLowerCase().trim() ||
        itemNameEs.toLowerCase().trim() === searchNameEs.toLowerCase().trim();
    });
    return match || null;
  }

  const kitchenToolsMap: Map<string, AdminRecipeKitchenTool> = new Map();
  const missingKitchenTools: string[] = [];

  for (const [index, kitchenTool] of kitchenToolNames.entries()) {
    const matchedKitchenTool = matchKitchenTool(kitchenTool, allKitchenTools);
    if (matchedKitchenTool) {
      // Extract notes translations from the parsed kitchen tool
      const noteTranslations = (kitchenTool as any).translations?.map((t: any) => ({
        locale: t.locale,
        notes: t.notes || '',
      })) || [];
      kitchenToolsMap.set(matchedKitchenTool.id, {
        id: `temp-${generateUUID()}`,
        recipeId: `temp-recipe-id`,
        kitchenToolId: matchedKitchenTool.id,
        // @ts-ignore - displayOrder should exist in markdown data
        displayOrder: kitchenTool.displayOrder || index,
        translations: noteTranslations,
        kitchenTool: matchedKitchenTool
      });
    } else {
      const nameEn = getTranslatedField(kitchenTool.translations, 'en', 'name');
      missingKitchenTools.push(nameEn);
    }
  }

  return { kitchenTools: Array.from(kitchenToolsMap.values()), missingKitchenTools };
}

export const parseRecipeMarkdown = async (markdown: string): Promise<ParseRecipeResult> => {
  try {
    const [allIngredients, allTags, allMeasurementUnits, allKitchenTools] = await Promise.all([
      adminIngredientsService.getAllIngredientsForAdmin(),
      adminRecipeTagService.getAllTags(),
      adminRecipeService.getAllMeasurementUnits(),
      adminKitchenToolsService.getAllKitchenTools()
    ]);

    const { data: responseData, error } = await supabase.functions.invoke('admin-ai-recipe-import', {
      body: { content: markdown },
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
      // Planner (My Week Setup) metadata — best-guess from AI, admin can override
      plannerRole: data.plannerRole ?? null,
      mealComponents: data.mealComponents ?? null,
      isCompleteMeal: data.isCompleteMeal ?? null,
      equipmentTags: data.equipmentTags ?? null,
      cookingLevel: data.cookingLevel ?? null,
      leftoversFriendly: data.leftoversFriendly ?? null,
      batchFriendly: data.batchFriendly ?? null,
      maxHouseholdSizeSupported: data.maxHouseholdSizeSupported ?? null,
      requiresMultiBatchNote: data.requiresMultiBatchNote || null,
    };
    
    // Process ingredients
    const { ingredients, missingIngredients } = processIngredients(data.ingredients, allIngredients, allMeasurementUnits);
    recipe.ingredients = ingredients;

    
    // Process tags
    const { tags, missingTags } = processTags(data.tags, allTags);

    // Resolve inferred meal-type values against existing "Meal Type" tag category.
    // Case-insensitive match against tag names; silently skip values with no matching tag
    // (do NOT invent tags — same rule as the main tag pipeline).
    const MEAL_TYPE_CATEGORY_MATCH = /meal\s*type/i;
    const mealTypeValues: string[] = Array.isArray(data.mealTypes) ? data.mealTypes : [];
    if (mealTypeValues.length > 0) {
      const mealTypeTags = (allTags as AdminRecipeTag[]).filter(t =>
        (t.categories || []).some((c: string) => MEAL_TYPE_CATEGORY_MATCH.test(c))
      );
      const existingIds = new Set(tags.map(t => t.id));
      for (const value of mealTypeValues) {
        const match = mealTypeTags.find(t => {
          const nameEn = getTranslatedField(t.translations, 'en', 'name');
          const nameEs = getTranslatedField(t.translations, 'es', 'name');
          return (
            nameEn.toLowerCase() === value.toLowerCase() ||
            nameEs.toLowerCase() === value.toLowerCase()
          );
        });
        if (match && !existingIds.has(match.id)) {
          tags.push(match);
          existingIds.add(match.id);
        }
      }
    }

    recipe.tags = tags;
    
    // Use the processed ingredients as the data source for finding ingredients used in the instruction
    recipe.steps = processSteps(data.steps, ingredients)

    // Process kitchen tools
    const { kitchenTools, missingKitchenTools } = processKitchenTools(data.kitchenTools, allKitchenTools);
    recipe.kitchenTools = kitchenTools;


    return {
      recipe,
      missingIngredients,
      missingTags,
      missingKitchenTools
    };
  } catch (error) {
    throw new Error(`Failed to parse recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 
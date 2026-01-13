import { supabase } from '@/lib/supabase';
import { AdminRecipe, AdminRecipeIngredient, AdminRecipeSteps, AdminRecipeTag, AdminRecipeUsefulItem } from '@/types/recipe.admin.types';
import { imageService } from '@/services/storage/imageService';
import { BaseService } from '@/services/base/BaseService';
import { SupabaseClient } from '@supabase/supabase-js';
import { RawRecipe, RawStepIngredient } from '@/types/recipe.api.types';
import { ThermomixSpeed, ThermomixSpeedSingle, ThermomixSpeedRange } from '@/types/thermomix.types';
class AdminRecipeService extends BaseService {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async getAllRecipesForAdmin(): Promise<AdminRecipe[]> {
    const query = this.supabase
      .from('recipes')
      .select(`
        id,
        name_en,
        name_es,
        picture_url,
        difficulty,
        prep_time,
        total_time,
        portions,
        is_published,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    const data = await this.transformedSelect<any[]>(query);
    return this.transformRecipeData(data);
  }

  async toggleRecipePublished(id: string, isPublished: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('recipes')
      .update({ is_published: isPublished })
      .eq('id', id);

    if (error) {
      throw new Error("Error toggling recipe published state: " + error.message);
    }
  }

  async getRecipeById(id: string): Promise<AdminRecipe | null> {
    const query = this.supabase
      .from('recipes')
      .select(`
        id,
        name_en,
        name_es,
        picture_url,
        difficulty,
        prep_time,
        total_time,
        portions,
        is_published,
        created_at,
        updated_at,
        tips_and_tricks_en,
        tips_and_tricks_es,
        useful_items:recipe_useful_items(
          *,
          useful_item:useful_items(
            id,
            name_en,
            name_es,
            picture_url
          )
        ),
        ingredients:recipe_ingredients(
          id,
          recipe_id,
          ingredient_id,
          quantity,
          optional,
          display_order,
          recipe_section_en,
          recipe_section_es,
          notes_en,
          notes_es,
          tip_en,
          tip_es,
          ingredient:ingredients(
            id,
            name_en,
            name_es,
            plural_name_en,
            plural_name_es,
            picture_url
          ),
          measurement_unit:measurement_units(
            id,
            type,
            system,
            name_en,
            name_es,
            name_en_plural,
            name_es_plural,
            symbol_en,
            symbol_es
          )
        ),
        tags:recipe_to_tag(
          tag:recipe_tags(
            id,
            name_en,
            name_es,
            categories
          )
        ),
        steps:recipe_steps(
          id,
          "order",
          instruction_en, 
          instruction_es,
          thermomix_time,
          thermomix_speed,
          thermomix_speed_start,
          thermomix_speed_end,
          thermomix_temperature,
          thermomix_temperature_unit,
          thermomix_is_blade_reversed,
          recipe_section_en,
          recipe_section_es,
          tip_en,
          tip_es,
          created_at,
          updated_at,
          ingredients:recipe_step_ingredients(
            id,
            ingredient_id,
            ingredient:ingredients(
              id,
              name_en,
              name_es,
              plural_name_en,
              plural_name_es,
              picture_url
            ),
            measurement_unit:measurement_units(
              id,
              name_en,
              name_es,
              symbol_en,
              symbol_es
            ),
            quantity,
            optional,
            display_order
          )
        )
      `)
      .eq('id', id)
      .single();

    const data = await this.transformedSelect<RawRecipe>(query);
    return data ? this.transformRecipeData([data])[0] : null;
  }

  async createRecipe(recipe: Partial<AdminRecipe>): Promise<string> {
    try {
      const recipeData = this.transformRequest({
        nameEn: recipe.nameEn,
        nameEs: recipe.nameEs,
        pictureUrl: recipe.pictureUrl,
        difficulty: recipe.difficulty,
        prepTime: recipe.prepTime,
        totalTime: recipe.totalTime,
        portions: recipe.portions,
        isPublished: recipe.isPublished,
        tipsAndTricksEn: recipe.tipsAndTricksEn,
        tipsAndTricksEs: recipe.tipsAndTricksEs,
      });

      // Handle image upload if it's a file object
      // A file object indicates that a new image is being uploaded
      if (recipe.pictureUrl && typeof recipe.pictureUrl === 'object') {
        recipeData.pictureUrl = await this.handleImageUpload({file: recipe.pictureUrl, nameEs: recipe.nameEs, nameEn: recipe.nameEn});
      }

      const { data: recipeId, error: recipeError } = await this.supabase
        .from('recipes')
        .insert(recipeData)
        .select('id')
        .single();

      if (recipeError) {
        throw new Error(`Failed to create recipe: ${recipeError.message}`);
      }

      if (recipe.ingredients?.length) {
        await this.updateRecipeIngredients(recipeId.id, recipe.ingredients);
      }

      if (recipe.tags?.length) {
        await this.updateRecipeTags(recipeId.id, recipe.tags);
      }

      if (recipe.steps?.length) {
        await this.updateRecipeSteps(recipeId.id, recipe.steps);
      }

      if (recipe.usefulItems?.length) {
        await this.updateRecipeUsefulItems(recipeId.id, recipe.usefulItems);
      }

      return recipeId.id;
    } catch (error) {
      console.error('Error in createRecipe:', error);
      throw error;
    }
  }

  async updateRecipe(id: string, recipe: Partial<AdminRecipe>): Promise<void> {
    const recipeData = this.transformRequest({
      nameEn: recipe.nameEn,
      nameEs: recipe.nameEs,
      pictureUrl: recipe.pictureUrl,
      difficulty: recipe.difficulty,
      prepTime: recipe.prepTime,
      totalTime: recipe.totalTime,
      portions: recipe.portions,
      isPublished: recipe.isPublished,
      tipsAndTricksEn: recipe.tipsAndTricksEn,
      tipsAndTricksEs: recipe.tipsAndTricksEs,
    });

    if (recipe.pictureUrl && typeof recipe.pictureUrl === 'object') {
      // Get old recipe to get the old image url
      const oldRecipe = await this.supabase
        .from('recipes')
        .select('picture_url')
        .eq('id', id)
        .single();

      if (oldRecipe?.data?.picture_url) {
        try {
          await this.deleteImage(oldRecipe.data.picture_url);
        } catch (error) {
          console.error('Error deleting old image:', error);
        }
      }

      recipeData.pictureUrl = await this.handleImageUpload({file: recipe.pictureUrl, nameEs: recipe.nameEs, nameEn: recipe.nameEn});
    }

    await this.transformedUpdate('recipes', id, recipeData);

    if (recipe.ingredients) {
      await this.updateRecipeIngredients(id, recipe.ingredients);
    }

    if (recipe.tags) {
      await this.updateRecipeTags(id, recipe.tags);
    }

    if (recipe.steps) {
      await this.updateRecipeSteps(id, recipe.steps);
    }

    if (recipe.usefulItems) {
      await this.updateRecipeUsefulItems(id, recipe.usefulItems);
    }
  }

  async updateRecipeIngredients(recipeId: string, recipeIngredients: AdminRecipeIngredient[]): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);
      
    if (deleteError) {
      throw new Error(`Failed to delete existing recipeIngredients: ${deleteError.message}`);
    }
    
    if (recipeIngredients.length === 0) return;
    
    const recipeIngredientsToInsert = recipeIngredients.map((recipeIngredient, index) => 
      this.transformRequest({
        recipeId,
        ingredientId: recipeIngredient.ingredientId,
        quantity: parseFloat(String(recipeIngredient.quantity || '0')),
        measurementUnitId: recipeIngredient.measurementUnit?.id || null,
        notesEn: recipeIngredient.notesEn || null,
        notesEs: recipeIngredient.notesEs || null,
        tipEn: recipeIngredient.tipEn || null,
        tipEs: recipeIngredient.tipEs || null,
        optional: recipeIngredient.optional || false,
        displayOrder: recipeIngredient.displayOrder || index,
        recipeSectionEn: recipeIngredient.recipeSectionEn || 'Main',
        recipeSectionEs: recipeIngredient.recipeSectionEs || 'Principal'
      })
    );

    const { error: insertError } = await this.supabase
      .from('recipe_ingredients')
      .insert(recipeIngredientsToInsert);
      
    if (insertError) {
      throw new Error(`Failed to insert ingredients: ${insertError.message}`);
    }
  }

  async updateRecipeTags(recipeId: string, tags: AdminRecipeTag[]): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('recipe_to_tag')
      .delete()
      .eq('recipe_id', recipeId);
      
    if (deleteError) {
      throw new Error(`Failed to delete existing tag mappings: ${deleteError.message}`);
    }
    
    if (tags.length === 0) return;
    
    const tagMappingsToInsert = tags.map(tag => 
      this.transformRequest({
        recipeId,
        tagId: tag.id
      })
    );
    
    try {
      await this.supabase
        .from('recipe_to_tag')
        .insert(tagMappingsToInsert);
        

    } catch (error) {
      throw error;
    }
  }

  async updateRecipeSteps(recipeId: string, recipeSteps: AdminRecipeSteps[]): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('recipe_steps')
      .delete()
      .eq('recipe_id', recipeId);
    if (deleteError) {
      throw new Error(`Failed to delete existing recipeSteps: ${deleteError.message}`);
    }
    
    if (recipeSteps.length === 0) return;
    
    const stepsToInsert = recipeSteps.map(recipeStep => {
      // Extract speed values from the ThermomixSpeed object
      let speedValue = null;
      let speedStart = null;
      let speedEnd = null;

      if (recipeStep.thermomixSpeed) {
        if (recipeStep.thermomixSpeed.type === 'single') {
          speedValue = recipeStep.thermomixSpeed.value;
        } else if (recipeStep.thermomixSpeed.type === 'range') {
          speedStart = recipeStep.thermomixSpeed.start;
          speedEnd = recipeStep.thermomixSpeed.end;
        }
      }

      return this.transformRequest({
        recipeId,
        order: recipeStep.order,
        instructionEn: recipeStep.instructionEn || '',
        instructionEs: recipeStep.instructionEs || '',
        thermomixTime: recipeStep.thermomixTime || null,
        thermomixIsBladeReversed: recipeStep.thermomixIsBladeReversed || null,
        thermomixSpeed: speedValue,
        thermomixSpeedStart: speedStart,
        thermomixSpeedEnd: speedEnd,
        thermomixTemperature: recipeStep.thermomixTemperature || null,
        thermomixTemperatureUnit: recipeStep.thermomixTemperatureUnit || null,
        recipeSectionEn: recipeStep.recipeSectionEn || 'Main',
        recipeSectionEs: recipeStep.recipeSectionEs || 'Principal',
        tipEn: recipeStep.tipEn || null,
        tipEs: recipeStep.tipEs || null
      });
    });
    
    const { data: insertedSteps, error: insertError } = await this.supabase
      .from('recipe_steps')
      .insert(stepsToInsert)
      .select('*');
    
    if (insertError) {
      throw new Error(`Failed to insert recipeSteps: ${insertError.message}`);
    }
  
    if (insertedSteps?.length) {
      await this.updateRecipeStepIngredients(recipeId, recipeSteps, insertedSteps);
    }
  }

  async updateRecipeStepIngredients(
    recipeId: string, 
    recipeSteps: AdminRecipeSteps[], 
    insertedSteps: Array<{ id: string, order: number }>
  ): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('recipe_step_ingredients')
      .delete()
      .eq('recipe_id', recipeId);
      
    if (deleteError) {
      throw new Error(`Failed to delete existing step ingredients: ${deleteError.message}`);
    }


    // Used to associate the newly created recipe_step id's with the one passed from user
    const stepOrderToIdMap = new Map(
      insertedSteps.map(step => [step.order, step.id])
    );
    const stepIngredientsToInsert: Array<RawStepIngredient> = [];
    
    recipeSteps.forEach(recipeStep => {
      if (!recipeStep.ingredients?.length) return;
      
      const stepId = stepOrderToIdMap.get(recipeStep.order);
      if (!stepId) {
        console.warn(`Could not find step ID for recipeStep order ${recipeStep.order}`);
        return;
      }
      recipeStep.ingredients.forEach((recipeStepIngredient, index) => {   
        if (!recipeStepIngredient.ingredient?.id) {
          console.warn(`Missing ingredient id for recipe step ${stepId}`)  
        }
        const transformedData = this.transformRequest({
          recipeId,
          recipeStepId: stepId, 
          ingredientId: recipeStepIngredient.ingredient?.id,
          measurementUnitId: recipeStepIngredient.measurementUnit?.id || null,
          quantity: parseFloat(String(recipeStepIngredient.quantity)),
          displayOrder: recipeStepIngredient.displayOrder || index,
          optional: recipeStepIngredient.optional || false
        }) as RawStepIngredient;
        
        stepIngredientsToInsert.push(transformedData);
      });
    });

    if (stepIngredientsToInsert.length) {
      const { error: insertError } = await this.supabase
        .from('recipe_step_ingredients')
        .insert(stepIngredientsToInsert);
        
      if (insertError) {
        throw new Error(`Failed to insert step ingredients: ${insertError.message}`);
      }
    }
  }

  async updateRecipeUsefulItems(recipeId: string, usefulItems: AdminRecipeUsefulItem[]): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('recipe_useful_items')
      .delete()
      .eq('recipe_id', recipeId);
      
    if (deleteError) {
      throw new Error(`Failed to delete existing useful items: ${deleteError.message}`);
    }

    if (usefulItems.length === 0) return;
    
    const usefulItemsToInsert = usefulItems.map(usefulItem => 
      this.transformRequest({
        recipeId,
        usefulItemId: usefulItem.usefulItemId,
        displayOrder: usefulItem.displayOrder,
        notesEn: usefulItem.notesEn || null,
        notesEs: usefulItem.notesEs || null
      })
    );

    const { error: insertError } = await this.supabase
      .from('recipe_useful_items')
      .insert(usefulItemsToInsert);
      
    if (insertError) {
      throw new Error(`Failed to insert useful items: ${insertError.message}`);
    }  
  }

  async getAllMeasurementUnits(): Promise<any[]> {
    const query = this.supabase
      .from('measurement_units')
      .select(`
        id,
        type,
        system,
        name_en,
        name_es,
        name_en_plural,
        name_es_plural,
        symbol_en,
        symbol_es
      `)
      .order('name_en', { ascending: true });

    return this.transformedSelect<any[]>(query);
  }

  async getAllTags(): Promise<any[]> {
    const query = this.supabase
      .from('recipe_tags')
      .select(`
        id,
        name_en,
        name_es,
        categories
      `)
      .order('name_en', { ascending: true });

    return this.transformedSelect<any[]>(query);
  }

  async deleteRecipe(id: string): Promise<void> {
    try {
      // Get the recipe to check if it has an image to delete
      const { data: recipe } = await this.supabase
        .from('recipes')
        .select('picture_url')
        .eq('id', id)
        .single();
        
      // If recipe had an image, delete it from storage
      if (recipe?.picture_url) {
        try {
          await this.deleteImage(recipe.picture_url);
        } catch (imageError) {
          console.error('Error deleting recipe image:', imageError);
          // Continue execution even if image deletion fails
        }
      }
      
      // Delete the recipe (cascade is handled by Supabase RLS policies)
      const { error } = await this.supabase
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete recipe: ${error.message}`);
      }

    } catch (error) {
      console.error('Error in deleteRecipe:', error);
      throw error;
    }
  }

  private transformRecipeData(data: RawRecipe[]): AdminRecipe[] {
    // Use the recursive transformation to handle most of the work
    const transformedRecipes = this.transformResponse<AdminRecipe[]>(data);
    // Handle special cases and field customizations that can't be handled by simple case conversion
    return transformedRecipes?.map(recipe => {
      if (recipe.ingredients?.length) {
        recipe.ingredients = recipe.ingredients
          .sort((a, b) => a.displayOrder - b.displayOrder);
      }

      if (recipe.steps?.length) {
        recipe.steps = recipe.steps.sort((a, b) => a.order - b.order)

        recipe.steps.forEach(step => {
          // Using 'as any' to access the raw properties that exist on the data but not in the final type
          const rawStep = step as any;
          if (rawStep.thermomixSpeed !== null && rawStep.thermomixSpeed !== undefined) {
            step.thermomixSpeed = {
              type: 'single',
              value: rawStep.thermomixSpeed
            } as ThermomixSpeedSingle;
          } else if (rawStep.thermomixSpeedStart !== null && rawStep.thermomixSpeedStart !== undefined && 
                     rawStep.thermomixSpeedEnd !== null && rawStep.thermomixSpeedEnd !== undefined) {
            step.thermomixSpeed = {
              type: 'range',
              start: rawStep.thermomixSpeedStart,
              end: rawStep.thermomixSpeedEnd
            } as ThermomixSpeedRange;
          }
        })
      }

      if (recipe.tags?.length) {
        // @ts-ignore - we know the structure from the DB query
        recipe.tags = recipe.tags.map(t => t.tag);
      }
      
      return recipe;
    }) || [];
  }

  // Image methods
  private async handleImageUpload({file, nameEs, nameEn}: {file: any, nameEs?: string, nameEn?: string}): Promise<string> {
    if (!file) return '';
    
    try {
      const fileName = `${nameEs || nameEn || 'recipe'}.png`;
      return await this.uploadImage({
        bucket: 'recipes',
        folderPath: 'images',
        fileName,
        file
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Error uploading image: ${error}`);
    }
  }


  // Image upload functionality
  uploadImage = imageService.uploadImage.bind(imageService);
  deleteImage = imageService.deleteImage.bind(imageService);
}

export const adminRecipeService = new AdminRecipeService(supabase);
export default adminRecipeService; 
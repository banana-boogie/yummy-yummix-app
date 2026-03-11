import { supabase } from '@/lib/supabase';
import {
  AdminRecipe, AdminRecipeIngredient, AdminRecipeSteps,
  AdminRecipeTag, AdminRecipeUsefulItem,
  AdminRecipeTranslation,
  getNameFromTranslations,
} from '@/types/recipe.admin.types';
import { imageService } from '@/services/storage/imageService';
import { BaseService } from '@/services/base/BaseService';
import { RawStepIngredient } from '@/types/recipe.api.types';
import { ThermomixSpeedSingle, ThermomixSpeedRange } from '@/types/thermomix.types';

class AdminRecipeService extends BaseService {
  async getAllRecipesForAdmin(): Promise<AdminRecipe[]> {
    const query = this.supabase
      .from('recipes')
      .select(`
        id,
        image_url,
        difficulty,
        prep_time,
        total_time,
        portions,
        is_published,
        created_at,
        updated_at,
        translations:recipe_translations (
          locale,
          name,
          tips_and_tricks
        )
      `)
      .order('created_at', { ascending: false });

    const data = await this.transformedSelect<any[]>(query);
    return this.transformRecipeListData(data);
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
        image_url,
        difficulty,
        prep_time,
        total_time,
        portions,
        is_published,
        created_at,
        updated_at,
        translations:recipe_translations (
          locale,
          name,
          tips_and_tricks
        ),
        useful_items:recipe_useful_items(
          *,
          translations:recipe_useful_item_translations (
            locale,
            notes
          ),
          useful_item:useful_items(
            id,
            image_url,
            translations:useful_item_translations (
              locale,
              name
            )
          )
        ),
        ingredients:recipe_ingredients(
          id,
          recipe_id,
          ingredient_id,
          quantity,
          optional,
          display_order,
          translations:recipe_ingredient_translations (
            locale,
            notes,
            tip,
            recipe_section
          ),
          ingredient:ingredients(
            id,
            image_url,
            translations:ingredient_translations (
              locale,
              name,
              plural_name
            )
          ),
          measurement_unit:measurement_units(
            id,
            type,
            system,
            translations:measurement_unit_translations (
              locale,
              name,
              name_plural,
              symbol,
              symbol_plural
            )
          )
        ),
        tags:recipe_to_tag(
          tag:recipe_tags(
            id,
            categories,
            translations:recipe_tag_translations (
              locale,
              name
            )
          )
        ),
        steps:recipe_steps(
          id,
          "order",
          thermomix_time,
          thermomix_speed,
          thermomix_speed_start,
          thermomix_speed_end,
          thermomix_temperature,
          thermomix_temperature_unit,
          thermomix_is_blade_reversed,
          created_at,
          updated_at,
          translations:recipe_step_translations (
            locale,
            instruction,
            recipe_section,
            tip
          ),
          ingredients:recipe_step_ingredients(
            id,
            ingredient_id,
            ingredient:ingredients(
              id,
              image_url,
              translations:ingredient_translations (
                locale,
                name,
                plural_name
              )
            ),
            measurement_unit:measurement_units(
              id,
              translations:measurement_unit_translations (
                locale,
                name,
                symbol
              )
            ),
            quantity,
            optional,
            display_order
          )
        )
      `)
      .eq('id', id)
      .single();

    const data = await this.transformedSelect<any>(query);
    return data ? this.transformRecipeDetailData(data) : null;
  }

  async createRecipe(recipe: Partial<AdminRecipe>): Promise<string> {
    try {
      let imageUrl = recipe.pictureUrl;
      if (recipe.pictureUrl && typeof recipe.pictureUrl === 'object') {
        imageUrl = await this.handleImageUpload({file: recipe.pictureUrl, translations: recipe.translations});
      }

      // Insert only non-translatable fields into recipes
      const recipeData = this.transformRequest({
        pictureUrl: imageUrl,
        difficulty: recipe.difficulty,
        prepTime: recipe.prepTime,
        totalTime: recipe.totalTime,
        portions: recipe.portions,
        isPublished: recipe.isPublished,
      });

      const { data: recipeId, error: recipeError } = await this.supabase
        .from('recipes')
        .insert(recipeData)
        .select('id')
        .single();

      if (recipeError) {
        throw new Error(`Failed to create recipe: ${recipeError.message}`);
      }

      // Insert translations from the translations array
      if (recipe.translations && recipe.translations.length > 0) {
        const dbTranslations = recipe.translations.map(t => ({
          recipe_id: recipeId.id,
          locale: t.locale,
          name: t.name,
          tips_and_tricks: t.tipsAndTricks || null,
        }));

        const { error: translationError } = await this.supabase
          .from('recipe_translations')
          .insert(dbTranslations);

        if (translationError) {
          throw new Error(`Failed to insert recipe translations: ${translationError.message}`);
        }
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
    // Build non-translatable fields only
    const nonTranslatableFields: Record<string, any> = {};
    if (recipe.difficulty !== undefined) nonTranslatableFields.difficulty = recipe.difficulty;
    if (recipe.prepTime !== undefined) nonTranslatableFields.prepTime = recipe.prepTime;
    if (recipe.totalTime !== undefined) nonTranslatableFields.totalTime = recipe.totalTime;
    if (recipe.portions !== undefined) nonTranslatableFields.portions = recipe.portions;
    if (recipe.isPublished !== undefined) nonTranslatableFields.isPublished = recipe.isPublished;

    if (recipe.pictureUrl && typeof recipe.pictureUrl === 'object') {
      const oldRecipe = await this.supabase
        .from('recipes')
        .select('image_url')
        .eq('id', id)
        .single();

      if (oldRecipe?.data?.image_url) {
        try {
          await this.deleteImage(oldRecipe.data.image_url);
        } catch (error) {
          console.error('Error deleting old image:', error);
        }
      }

      nonTranslatableFields.pictureUrl = await this.handleImageUpload({file: recipe.pictureUrl, translations: recipe.translations});
    } else if (recipe.pictureUrl !== undefined) {
      nonTranslatableFields.pictureUrl = recipe.pictureUrl;
    }

    if (Object.keys(nonTranslatableFields).length > 0) {
      await this.transformedUpdate('recipes', id, nonTranslatableFields);
    }

    // Upsert translations from the translations array
    if (recipe.translations && recipe.translations.length > 0) {
      const dbTranslations = recipe.translations.map(t => ({
        recipe_id: id,
        locale: t.locale,
        name: t.name,
        tips_and_tricks: t.tipsAndTricks || null,
      }));

      const { error: translationError } = await this.supabase
        .from('recipe_translations')
        .upsert(dbTranslations, { onConflict: 'recipe_id,locale' });

      if (translationError) {
        throw new Error(`Failed to upsert recipe translations: ${translationError.message}`);
      }
    }

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

    // Insert only non-translatable fields
    const recipeIngredientsToInsert = recipeIngredients.map((recipeIngredient, index) =>
      this.transformRequest({
        recipeId,
        ingredientId: recipeIngredient.ingredientId,
        quantity: parseFloat(String(recipeIngredient.quantity || '0')),
        measurementUnitId: recipeIngredient.measurementUnit?.id || null,
        optional: recipeIngredient.optional || false,
        displayOrder: recipeIngredient.displayOrder || index,
      })
    );

    const { data: insertedRows, error: insertError } = await this.supabase
      .from('recipe_ingredients')
      .insert(recipeIngredientsToInsert)
      .select('id, display_order');

    if (insertError) {
      throw new Error(`Failed to insert ingredients: ${insertError.message}`);
    }

    // Build translations using display_order to map back to original items
    if (insertedRows?.length) {
      const orderToIdMap = new Map(
        insertedRows.map((row: any) => [row.display_order, row.id])
      );

      const translations: any[] = [];
      recipeIngredients.forEach((recipeIngredient, index) => {
        const displayOrder = recipeIngredient.displayOrder || index;
        const rowId = orderToIdMap.get(displayOrder);
        if (!rowId) return;

        // Use translations array if available
        if (recipeIngredient.translations && recipeIngredient.translations.length > 0) {
          recipeIngredient.translations.forEach(t => {
            translations.push({
              recipe_ingredient_id: rowId,
              locale: t.locale,
              notes: t.notes || null,
              recipe_section: t.recipeSection || null,
              tip: t.tip || null,
            });
          });
        }
      });

      if (translations.length > 0) {
        const { error: translationError } = await this.supabase
          .from('recipe_ingredient_translations')
          .insert(translations);

        if (translationError) {
          throw new Error(`Failed to insert ingredient translations: ${translationError.message}`);
        }
      }
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

    // Insert only non-translatable fields
    const stepsToInsert = recipeSteps.map(recipeStep => {
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
        thermomixTime: recipeStep.thermomixTime || null,
        thermomixIsBladeReversed: recipeStep.thermomixIsBladeReversed || null,
        thermomixSpeed: speedValue,
        thermomixSpeedStart: speedStart,
        thermomixSpeedEnd: speedEnd,
        thermomixTemperature: recipeStep.thermomixTemperature || null,
        thermomixTemperatureUnit: recipeStep.thermomixTemperatureUnit || null,
      });
    });

    const { data: insertedSteps, error: insertError } = await this.supabase
      .from('recipe_steps')
      .insert(stepsToInsert)
      .select('id, order');

    if (insertError) {
      throw new Error(`Failed to insert recipeSteps: ${insertError.message}`);
    }

    // Insert step translations
    if (insertedSteps?.length) {
      const orderToIdMap = new Map(
        insertedSteps.map((step: any) => [step.order, step.id])
      );

      const translations: any[] = [];
      recipeSteps.forEach(recipeStep => {
        const stepId = orderToIdMap.get(recipeStep.order);
        if (!stepId) return;

        // Use translations array if available
        if (recipeStep.translations && recipeStep.translations.length > 0) {
          recipeStep.translations.forEach(t => {
            translations.push({
              recipe_step_id: stepId,
              locale: t.locale,
              instruction: t.instruction || '',
              recipe_section: t.recipeSection || null,
              tip: t.tip || null,
            });
          });
        }
      });

      if (translations.length > 0) {
        const { error: translationError } = await this.supabase
          .from('recipe_step_translations')
          .insert(translations);

        if (translationError) {
          throw new Error(`Failed to insert step translations: ${translationError.message}`);
        }
      }

      await this.updateRecipeStepIngredients(recipeId, recipeSteps, insertedSteps);
    }
  }

  async updateRecipeStepIngredients(
    recipeId: string,
    recipeSteps: AdminRecipeSteps[],
    insertedSteps: { id: string, order: number }[]
  ): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('recipe_step_ingredients')
      .delete()
      .eq('recipe_id', recipeId);

    if (deleteError) {
      throw new Error(`Failed to delete existing step ingredients: ${deleteError.message}`);
    }

    const stepOrderToIdMap = new Map(
      insertedSteps.map(step => [step.order, step.id])
    );
    const stepIngredientsToInsert: RawStepIngredient[] = [];

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

    // Insert only non-translatable fields
    const usefulItemsToInsert = usefulItems.map(usefulItem =>
      this.transformRequest({
        recipeId,
        usefulItemId: usefulItem.usefulItemId,
        displayOrder: usefulItem.displayOrder,
      })
    );

    const { data: insertedRows, error: insertError } = await this.supabase
      .from('recipe_useful_items')
      .insert(usefulItemsToInsert)
      .select('id, display_order');

    if (insertError) {
      throw new Error(`Failed to insert useful items: ${insertError.message}`);
    }

    // Insert translations
    if (insertedRows?.length) {
      const orderToIdMap = new Map(
        insertedRows.map((row: any) => [row.display_order, row.id])
      );

      const translations: any[] = [];
      usefulItems.forEach(usefulItem => {
        const rowId = orderToIdMap.get(usefulItem.displayOrder);
        if (!rowId) return;

        // Use translations array if available
        if (usefulItem.translations && usefulItem.translations.length > 0) {
          usefulItem.translations.forEach(t => {
            translations.push({
              recipe_useful_item_id: rowId,
              locale: t.locale,
              notes: t.notes || null,
            });
          });
        }
      });

      if (translations.length > 0) {
        const { error: translationError } = await this.supabase
          .from('recipe_useful_item_translations')
          .insert(translations);

        if (translationError) {
          throw new Error(`Failed to insert useful item translations: ${translationError.message}`);
        }
      }
    }
  }

  async getAllMeasurementUnits(): Promise<any[]> {
    const query = this.supabase
      .from('measurement_units')
      .select(`
        id,
        type,
        system,
        translations:measurement_unit_translations (
          locale,
          name,
          name_plural,
          symbol,
          symbol_plural
        )
      `)
      .order('id', { ascending: true });

    const data = await this.transformedSelect<any[]>(query);
    return (data || []).map((item: any) => ({
      id: item.id,
      type: item.type,
      system: item.system,
      translations: (item.translations || []).map((t: any) => ({
        locale: t.locale,
        name: t.name || '',
        namePlural: t.name_plural || t.namePlural || '',
        symbol: t.symbol || '',
        symbolPlural: t.symbol_plural || t.symbolPlural || '',
      })),
    }));
  }

  async getAllTags(): Promise<any[]> {
    const query = this.supabase
      .from('recipe_tags')
      .select(`
        id,
        categories,
        translations:recipe_tag_translations (
          locale,
          name
        )
      `)
      .order('id', { ascending: true });

    const data = await this.transformedSelect<any[]>(query);
    return (data || []).map((item: any) => ({
      id: item.id,
      translations: (item.translations || []).map((t: any) => ({
        locale: t.locale,
        name: t.name || '',
      })),
      categories: item.categories,
    }));
  }

  async deleteRecipe(id: string): Promise<void> {
    try {
      const { data: recipe } = await this.supabase
        .from('recipes')
        .select('image_url')
        .eq('id', id)
        .single();

      if (recipe?.image_url) {
        try {
          await this.deleteImage(recipe.image_url);
        } catch (imageError) {
          console.error('Error deleting recipe image:', imageError);
        }
      }

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

  /**
   * Transform recipe list data from translation tables to admin format.
   * Returns translations arrays instead of nameEn/nameEs pairs.
   */
  private transformRecipeListData(data: any[]): AdminRecipe[] {
    if (!data) return [];
    return data.map(recipe => {
      return {
        id: recipe.id,
        pictureUrl: recipe.imageUrl || recipe.image_url,
        difficulty: recipe.difficulty,
        prepTime: recipe.prepTime ?? recipe.prep_time,
        totalTime: recipe.totalTime ?? recipe.total_time,
        portions: recipe.portions,
        isPublished: recipe.isPublished ?? recipe.is_published,
        createdAt: recipe.createdAt ?? recipe.created_at,
        updatedAt: recipe.updatedAt ?? recipe.updated_at,
        translations: (recipe.translations || []).map((t: any) => ({
          locale: t.locale,
          name: t.name || '',
          tipsAndTricks: t.tips_and_tricks || t.tipsAndTricks || undefined,
        })),
        ingredients: [],
        tags: [],
        steps: [],
      } as AdminRecipe;
    });
  }

  /**
   * Transform a single recipe detail from translation tables to admin format.
   * Returns translations arrays instead of nameEn/nameEs pairs.
   */
  private transformRecipeDetailData(recipe: any): AdminRecipe {
    const result: any = {
      id: recipe.id,
      pictureUrl: recipe.imageUrl || recipe.image_url,
      difficulty: recipe.difficulty,
      prepTime: recipe.prepTime ?? recipe.prep_time,
      totalTime: recipe.totalTime ?? recipe.total_time,
      portions: recipe.portions,
      isPublished: recipe.isPublished ?? recipe.is_published,
      createdAt: recipe.createdAt ?? recipe.created_at,
      updatedAt: recipe.updatedAt ?? recipe.updated_at,
      translations: (recipe.translations || []).map((t: any) => ({
        locale: t.locale,
        name: t.name || '',
        tipsAndTricks: t.tips_and_tricks || t.tipsAndTricks || undefined,
      })),
    };

    // Transform ingredients
    if (recipe.ingredients?.length) {
      result.ingredients = recipe.ingredients
        .map((ri: any) => {
          const mu = ri.measurementUnit || ri.measurement_unit;

          return {
            id: ri.id,
            ingredientId: ri.ingredientId || ri.ingredient_id,
            ingredient: {
              id: ri.ingredient?.id,
              translations: (ri.ingredient?.translations || []).map((t: any) => ({
                locale: t.locale,
                name: t.name || '',
                pluralName: t.plural_name || t.pluralName || undefined,
              })),
              pictureUrl: ri.ingredient?.imageUrl || ri.ingredient?.image_url || '',
              nutritionalFacts: ri.ingredient?.nutritionalFacts || ri.ingredient?.nutritional_facts,
            },
            quantity: ri.quantity,
            translations: (ri.translations || []).map((t: any) => ({
              locale: t.locale,
              notes: t.notes || undefined,
              tip: t.tip || undefined,
              recipeSection: t.recipe_section || t.recipeSection || undefined,
            })),
            optional: ri.optional,
            displayOrder: ri.displayOrder || ri.display_order,
            measurementUnit: mu ? {
              id: mu.id,
              type: mu.type,
              system: mu.system,
              translations: (mu.translations || []).map((t: any) => ({
                locale: t.locale,
                name: t.name || '',
                namePlural: t.name_plural || t.namePlural || '',
                symbol: t.symbol || '',
                symbolPlural: t.symbol_plural || t.symbolPlural || '',
              })),
            } : undefined,
          };
        })
        .sort((a: any, b: any) => a.displayOrder - b.displayOrder);
    } else {
      result.ingredients = [];
    }

    // Transform tags
    if (recipe.tags?.length) {
      result.tags = recipe.tags.map((t: any) => {
        const tag = t.tag;
        if (!tag) return null;
        return {
          id: tag.id,
          translations: (tag.translations || []).map((tr: any) => ({
            locale: tr.locale,
            name: tr.name || '',
          })),
          categories: tag.categories,
        };
      }).filter(Boolean);
    } else {
      result.tags = [];
    }

    // Transform steps
    if (recipe.steps?.length) {
      result.steps = recipe.steps
        .map((step: any) => {
          const rawStep = step;
          const transformed: any = {
            id: step.id,
            order: step.order,
            translations: (step.translations || []).map((t: any) => ({
              locale: t.locale,
              instruction: t.instruction || '',
              recipeSection: t.recipe_section || t.recipeSection || undefined,
              tip: t.tip || undefined,
            })),
            thermomixTime: rawStep.thermomixTime ?? rawStep.thermomix_time,
            thermomixTemperature: rawStep.thermomixTemperature ?? rawStep.thermomix_temperature,
            thermomixTemperatureUnit: rawStep.thermomixTemperatureUnit ?? rawStep.thermomix_temperature_unit,
            thermomixIsBladeReversed: rawStep.thermomixIsBladeReversed ?? rawStep.thermomix_is_blade_reversed,
          };

          // Handle speed
          const speed = rawStep.thermomixSpeed ?? rawStep.thermomix_speed;
          const speedStart = rawStep.thermomixSpeedStart ?? rawStep.thermomix_speed_start;
          const speedEnd = rawStep.thermomixSpeedEnd ?? rawStep.thermomix_speed_end;
          if (speed !== null && speed !== undefined) {
            transformed.thermomixSpeed = { type: 'single', value: speed } as ThermomixSpeedSingle;
          } else if (speedStart !== null && speedStart !== undefined &&
                     speedEnd !== null && speedEnd !== undefined) {
            transformed.thermomixSpeed = { type: 'range', start: speedStart, end: speedEnd } as ThermomixSpeedRange;
          }

          // Transform step ingredients
          if (step.ingredients?.length) {
            transformed.ingredients = step.ingredients.map((si: any) => {
              const siMu = si.measurementUnit || si.measurement_unit;

              return {
                id: si.id,
                ingredientId: si.ingredientId || si.ingredient_id,
                ingredient: {
                  id: si.ingredient?.id,
                  translations: (si.ingredient?.translations || []).map((t: any) => ({
                    locale: t.locale,
                    name: t.name || '',
                    pluralName: t.plural_name || t.pluralName || undefined,
                  })),
                  pictureUrl: si.ingredient?.imageUrl || si.ingredient?.image_url || '',
                },
                measurementUnit: siMu ? {
                  id: siMu.id,
                  translations: (siMu.translations || []).map((t: any) => ({
                    locale: t.locale,
                    name: t.name || '',
                    symbol: t.symbol || '',
                  })),
                } : undefined,
                quantity: si.quantity,
                optional: si.optional,
                displayOrder: si.displayOrder || si.display_order,
              };
            });
          }

          return transformed;
        })
        .sort((a: any, b: any) => a.order - b.order);
    } else {
      result.steps = [];
    }

    // Transform useful items
    if (recipe.usefulItems?.length || recipe.useful_items?.length) {
      const items = recipe.usefulItems || recipe.useful_items;
      result.usefulItems = items.map((ui: any) => {
        const uiItem = ui.usefulItem || ui.useful_item;
        return {
          id: ui.id,
          recipeId: ui.recipeId || ui.recipe_id,
          usefulItemId: ui.usefulItemId || ui.useful_item_id,
          displayOrder: ui.displayOrder || ui.display_order,
          translations: (ui.translations || []).map((t: any) => ({
            locale: t.locale,
            notes: t.notes || undefined,
          })),
          usefulItem: {
            id: uiItem?.id,
            translations: (uiItem?.translations || []).map((t: any) => ({
              locale: t.locale,
              name: t.name || '',
            })),
            pictureUrl: uiItem?.imageUrl || uiItem?.image_url || '',
          },
        };
      });
    } else {
      result.usefulItems = [];
    }

    return result as AdminRecipe;
  }

  // Image methods
  private async handleImageUpload({file, translations}: {file: any, translations?: AdminRecipeTranslation[]}): Promise<string> {
    if (!file) return '';

    try {
      const fileName = `${getNameFromTranslations(translations, 'recipe')}.png`;
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

  uploadImage = imageService.uploadImage.bind(imageService);
  deleteImage = imageService.deleteImage.bind(imageService);
}

export const adminRecipeService = new AdminRecipeService(supabase);
export default adminRecipeService;

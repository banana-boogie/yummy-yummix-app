import { supabase } from '@/lib/supabase';
import { AdminIngredient, AdminIngredientTranslation, NutritionalFacts, pickTranslation, getNameFromTranslations } from '@/types/recipe.admin.types';
import { BaseService } from '../base/BaseService';
import { imageService } from '../storage/imageService';
import logger from '@/services/logger';

export class AdminIngredientsService extends BaseService {
  constructor() {
    super(supabase);
  }

  async getAllIngredientsForAdmin(sortBy: 'en' | 'es' = 'en'): Promise<AdminIngredient[]> {
    const { data, error } = await this.supabase
      .from('ingredients')
      .select(`
        id,
        image_url,
        translations:ingredient_translations (
          locale,
          name,
          plural_name
        ),
        nutrition:ingredient_nutrition (
          calories,
          protein,
          fat,
          carbohydrates,
          source
        )
      `)
      .order('id', { ascending: true });

    if (error) {
      logger.error('Error fetching ingredients:', error);
      throw new Error(`Error fetching ingredients: ${error.message}`);
    }

    const result: AdminIngredient[] = (data || []).map((item: any) => {
      // nutrition is a 1:1 relation — PostgREST returns single object or null
      const n = Array.isArray(item.nutrition) ? item.nutrition[0] : item.nutrition;
      return {
        id: item.id,
        translations: (item.translations || []).map((t: any) => ({
          locale: t.locale,
          name: t.name || '',
          pluralName: t.plural_name || undefined,
        })),
        pictureUrl: item.image_url,
        nutritionalFacts: n ? {
          calories: n.calories,
          protein: n.protein,
          fat: n.fat,
          carbohydrates: n.carbohydrates,
        } : undefined,
      };
    });

    // Sort client-side since we can't sort by translation table column via PostgREST
    const sortLocale = sortBy;
    result.sort((a: AdminIngredient, b: AdminIngredient) => {
      const aName = pickTranslation(a.translations, sortLocale)?.name || '';
      const bName = pickTranslation(b.translations, sortLocale)?.name || '';
      return aName.localeCompare(bName);
    });

    return result;
  }

  private async handleImageUpload(file: any, translations?: AdminIngredientTranslation[]): Promise<string> {
    if (!file) return '';

    try {
      const fileName = `${getNameFromTranslations(translations, 'ingredient')}.png`;
      return await this.uploadImage({
        bucket: 'ingredients',
        folderPath: 'images',
        fileName,
        file,
        forcePNG: true // Always use PNG for ingredients
      });
    } catch (error) {
      logger.error('Error uploading image:', error);
      throw new Error(`Error uploading image: ${error}`);
    }
  }

  /**
   * Persist or delete ingredient nutrition.
   * If any of the 4 core fields has a value, upsert the row.
   * If all are empty/undefined, delete the row.
   */
  private async persistNutrition(ingredientId: string, nf: NutritionalFacts | undefined): Promise<void> {
    if (nf === undefined) return;

    const hasValues = (nf.calories !== undefined && nf.calories !== '') ||
      (nf.protein !== undefined && nf.protein !== '') ||
      (nf.fat !== undefined && nf.fat !== '') ||
      (nf.carbohydrates !== undefined && nf.carbohydrates !== '');

    if (hasValues) {
      const { error } = await this.supabase
        .from('ingredient_nutrition')
        .upsert({
          ingredient_id: ingredientId,
          calories: nf.calories !== '' && nf.calories !== undefined ? Number(nf.calories) : null,
          protein: nf.protein !== '' && nf.protein !== undefined ? Number(nf.protein) : null,
          fat: nf.fat !== '' && nf.fat !== undefined ? Number(nf.fat) : null,
          carbohydrates: nf.carbohydrates !== '' && nf.carbohydrates !== undefined ? Number(nf.carbohydrates) : null,
          source: 'manual',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'ingredient_id' });
      if (error) {
        throw new Error(`Failed to upsert nutrition: ${error.message}`);
      }
    } else {
      // All fields empty — delete the nutrition row
      const { error } = await this.supabase
        .from('ingredient_nutrition')
        .delete()
        .eq('ingredient_id', ingredientId);
      if (error) {
        throw new Error(`Failed to delete nutrition: ${error.message}`);
      }
    }
  }

  async updateIngredient(id: string, ingredient: AdminIngredient): Promise<AdminIngredient> {
    const ingredientData: Record<string, any> = {};

    // Handle image update only if pictureUrl is explicitly provided and is different
    if (ingredient.pictureUrl !== undefined) {
      const { data: currentIngredient, error: fetchError } = await this.supabase
        .from('ingredients')
        .select('image_url')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(`Error fetching current ingredient: ${fetchError.message}`);
      }

      const isNewImage = typeof ingredient.pictureUrl === 'object';
      const isDifferentUrl = ingredient.pictureUrl !== currentIngredient?.image_url;

      if (isNewImage || isDifferentUrl) {
        if (currentIngredient?.image_url) {
          try {
            await this.deleteImage(currentIngredient.image_url);
          } catch (error) {
            logger.error('Error deleting old image:', error);
          }
        }

        if (isNewImage) {
          ingredientData.image_url = await this.handleImageUpload(
            ingredient.pictureUrl,
            ingredient.translations
          );
        } else {
          ingredientData.image_url = ingredient.pictureUrl;
        }
      }
    }

    if (Object.keys(ingredientData).length > 0) {
      const updatedIngredient = await this.transformedUpdate<AdminIngredient>('ingredients', id, ingredientData);
      if (!updatedIngredient) {
        throw new Error('Failed to update ingredient');
      }
    }

    // Handle nutrition separately
    if (ingredient.nutritionalFacts !== undefined) {
      await this.persistNutrition(id, ingredient.nutritionalFacts);
    }

    // Upsert translations from the translations array
    if (ingredient.translations && ingredient.translations.length > 0) {
      const dbTranslations = ingredient.translations.map(t => ({
        ingredient_id: id,
        locale: t.locale,
        name: t.name,
        plural_name: t.pluralName || null,
      }));

      const { error: translationError } = await this.supabase
        .from('ingredient_translations')
        .upsert(dbTranslations, { onConflict: 'ingredient_id,locale' });

      if (translationError) {
        if (translationError.message?.includes('unique constraint') || translationError.code === '23505') {
          throw new Error('An ingredient with this name already exists. Please use a different name.');
        }
        throw new Error(`Failed to upsert ingredient translations: ${translationError.message}`);
      }
    }

    return {
      ...ingredient,
      pictureUrl: ingredientData.image_url ?? ingredient.pictureUrl,
    };
  }

  async deleteIngredient(id: string): Promise<void> {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid ingredient ID provided');
    }

    const { error } = await this.supabase
      .from('ingredients')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting ingredient:', error);
      throw new Error(`Error deleting ingredient: ${error.message}`);
    }
  }

  async createIngredient(ingredient: any): Promise<AdminIngredient> {
    // Support both old (nameEn/nameEs) and new (translations) formats
    const translations: AdminIngredientTranslation[] = ingredient.translations || [];

    const ingredientData: Record<string, any> = {
      image_url: '',
    };

    if (ingredient.pictureUrl) {
      ingredientData.image_url = await this.handleImageUpload(
        ingredient.pictureUrl,
        translations
      );
    }

    // Insert the ingredient and get the ID back
    const { data: inserted, error: insertError } = await this.supabase
      .from('ingredients')
      .insert(ingredientData)
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create ingredient: ${insertError.message}`);
    }

    // Insert translations from the translations array
    const dbTranslations = translations.map(t => ({
      ingredient_id: inserted.id,
      locale: t.locale,
      name: t.name,
      plural_name: t.pluralName || null,
    }));

    if (dbTranslations.length > 0) {
      const { error: translationError } = await this.supabase
        .from('ingredient_translations')
        .insert(dbTranslations);

      if (translationError) {
        // Clean up orphaned ingredient row and uploaded image before throwing
        await this.supabase.from('ingredients').delete().eq('id', inserted.id);
        if (ingredientData.image_url) {
          try { await this.deleteImage(ingredientData.image_url); } catch { /* best effort */ }
        }
        if (translationError.message?.includes('unique constraint') || translationError.code === '23505') {
          throw new Error('An ingredient with this name already exists. Please use a different name.');
        }
        throw new Error(`Failed to insert ingredient translations: ${translationError.message}`);
      }
    }

    // Upsert nutrition if provided
    try {
      await this.persistNutrition(inserted.id, ingredient.nutritionalFacts);
    } catch (nutritionError) {
      // Clean up orphaned ingredient row and uploaded image before throwing
      await this.supabase.from('ingredients').delete().eq('id', inserted.id);
      if (ingredientData.image_url) {
        try { await this.deleteImage(ingredientData.image_url); } catch { /* best effort */ }
      }
      throw nutritionError;
    }

    return {
      id: inserted.id,
      translations,
      pictureUrl: ingredientData.image_url,
      nutritionalFacts: ingredient.nutritionalFacts,
    };
  }

  // Image methods
  uploadImage = imageService.uploadImage.bind(imageService);
  deleteImage = imageService.deleteImage.bind(imageService);
}

export const adminIngredientsService = new AdminIngredientsService();
export default adminIngredientsService;

import { supabase } from '@/lib/supabase';
import { AdminIngredient } from '@/types/recipe.admin.types';
import { BaseService } from '../base/BaseService';
import { imageService } from '../storage/imageService';

/**
 * Helper to pick a translation value from an array of translations by locale.
 */
function pickByLocale<T extends { locale: string }>(
  translations: T[] | undefined | null,
  locale: string,
): T | undefined {
  if (!translations) return undefined;
  return translations.find(t => t.locale === locale);
}

export class AdminIngredientsService extends BaseService {
  constructor() {
    super(supabase);
  }

  async getAllIngredientsForAdmin(sortBy: 'name_en' | 'name_es' = 'name_en'): Promise<AdminIngredient[]> {
    const { data, error } = await this.supabase
      .from('ingredients')
      .select(`
        id,
        image_url,
        nutritional_facts,
        translations:ingredient_translations (
          locale,
          name,
          plural_name
        )
      `)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching ingredients:', error);
      throw new Error(`Error fetching ingredients: ${error.message}`);
    }

    const result = (data || []).map((item: any) => {
      const en = pickByLocale(item.translations, 'en');
      const es = pickByLocale(item.translations, 'es');
      return {
        id: item.id,
        nameEn: en?.name || undefined,
        nameEs: es?.name || undefined,
        pluralNameEn: en?.plural_name || undefined,
        pluralNameEs: es?.plural_name || undefined,
        pictureUrl: item.image_url,
        nutritionalFacts: item.nutritional_facts
      };
    });

    // Sort client-side since we can't sort by translation table column via PostgREST
    result.sort((a: AdminIngredient, b: AdminIngredient) => {
      const aVal = sortBy === 'name_es' ? (a.nameEs || '') : (a.nameEn || '');
      const bVal = sortBy === 'name_es' ? (b.nameEs || '') : (b.nameEn || '');
      return aVal.localeCompare(bVal);
    });

    return result;
  }

  private async handleImageUpload(file: any, nameEs?: string, nameEn?: string): Promise<string> {
    if (!file) return '';

    try {
      const fileName = `${nameEs || nameEn || 'ingredient'}.png`;
      return await this.uploadImage({
        bucket: 'ingredients',
        folderPath: 'images',
        fileName,
        file,
        forcePNG: true // Always use PNG for ingredients
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Error uploading image: ${error}`);
    }
  }

  async updateIngredient(id: string, ingredient: AdminIngredient): Promise<AdminIngredient> {
    const ingredientData: Record<string, any> = {};

    // Write to old _en/_es columns (sync triggers update translation tables)
    if (ingredient.nameEn !== undefined) ingredientData.name_en = ingredient.nameEn;
    if (ingredient.pluralNameEn !== undefined) ingredientData.plural_name_en = ingredient.pluralNameEn;
    if (ingredient.nameEs !== undefined) ingredientData.name_es = ingredient.nameEs;
    if (ingredient.pluralNameEs !== undefined) ingredientData.plural_name_es = ingredient.pluralNameEs;

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
            console.error('Error deleting old image:', error);
          }
        }

        if (isNewImage) {
          ingredientData.image_url = await this.handleImageUpload(
            ingredient.pictureUrl,
            ingredient.nameEs,
            ingredient.nameEn
          );
        } else {
          ingredientData.image_url = ingredient.pictureUrl;
        }
      }
    }

    if (ingredient.nutritionalFacts !== undefined) ingredientData.nutritional_facts = ingredient.nutritionalFacts;

    if (Object.keys(ingredientData).length > 0) {
      const updatedIngredient = await this.transformedUpdate<AdminIngredient>('ingredients', id, ingredientData);
      if (!updatedIngredient) {
        throw new Error('Failed to update ingredient');
      }
      return updatedIngredient;
    }

    return ingredient;
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
      console.error('Error deleting ingredient:', error);
      throw new Error(`Error deleting ingredient: ${error.message}`);
    }
  }

  async createIngredient(ingredient: any): Promise<AdminIngredient> {
    // Write to old _en/_es columns (sync triggers update translation tables)
    const ingredientData = {
      name_en: ingredient.nameEn,
      name_es: ingredient.nameEs,
      plural_name_en: ingredient.pluralNameEn,
      plural_name_es: ingredient.pluralNameEs,
      image_url: '',
      nutritional_facts: ingredient.nutritionalFacts,
    };

    if (ingredient.pictureUrl) {
      ingredientData.image_url = await this.handleImageUpload(
        ingredient.pictureUrl,
        ingredient.nameEs,
        ingredient.nameEn
      );
    }

    const result = await this.transformedInsert<AdminIngredient>('ingredients', ingredientData);
    return result;
  }

  // Image methods
  uploadImage = imageService.uploadImage.bind(imageService);
  deleteImage = imageService.deleteImage.bind(imageService);
}

export const adminIngredientsService = new AdminIngredientsService();
export default adminIngredientsService;

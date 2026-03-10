import { supabase } from '@/lib/supabase';
import { AdminIngredient, AdminIngredientTranslation } from '@/types/recipe.admin.types';
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

/**
 * Helper: extract a name from translations, trying the given locale first, then any.
 */
function getNameFromTranslations(translations: AdminIngredientTranslation[] | undefined): string {
  if (!translations || translations.length === 0) return 'ingredient';
  const es = pickByLocale(translations, 'es');
  if (es?.name) return es.name;
  const en = pickByLocale(translations, 'en');
  if (en?.name) return en.name;
  return translations[0]?.name || 'ingredient';
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

    const result: AdminIngredient[] = (data || []).map((item: any) => ({
      id: item.id,
      translations: (item.translations || []).map((t: any) => ({
        locale: t.locale,
        name: t.name || '',
        pluralName: t.plural_name || undefined,
      })),
      pictureUrl: item.image_url,
      nutritionalFacts: item.nutritional_facts,
    }));

    // Sort client-side since we can't sort by translation table column via PostgREST
    const sortLocale = sortBy === 'name_es' ? 'es' : 'en';
    result.sort((a: AdminIngredient, b: AdminIngredient) => {
      const aName = pickByLocale(a.translations, sortLocale)?.name || '';
      const bName = pickByLocale(b.translations, sortLocale)?.name || '';
      return aName.localeCompare(bName);
    });

    return result;
  }

  private async handleImageUpload(file: any, translations?: AdminIngredientTranslation[]): Promise<string> {
    if (!file) return '';

    try {
      const fileName = `${getNameFromTranslations(translations)}.png`;
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
            ingredient.translations
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
        throw new Error(`Failed to upsert ingredient translations: ${translationError.message}`);
      }
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
    // Support both old (nameEn/nameEs) and new (translations) formats
    const translations: AdminIngredientTranslation[] = ingredient.translations || [];

    const ingredientData: Record<string, any> = {
      image_url: '',
      nutritional_facts: ingredient.nutritionalFacts,
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
        throw new Error(`Failed to insert ingredient translations: ${translationError.message}`);
      }
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

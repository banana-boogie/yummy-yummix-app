import { supabase } from '@/lib/supabase';
import { AdminIngredient } from '@/types/recipe.admin.types';
import { BaseService } from '../base/BaseService';
import { imageService } from '../storage/imageService';

export class AdminIngredientsService extends BaseService {
  constructor() {
    super(supabase);
  }

  async getAllIngredientsForAdmin(sortBy: 'name_en' | 'name_es' = 'name_en'): Promise<AdminIngredient[]> {
    const { data, error } = await this.supabase
      .from('ingredients')
      .select(`
        id,
        name_en,
        name_es,
        plural_name_en,
        plural_name_es,
        picture_url,
        nutritional_facts
      `)
      .order(sortBy, { ascending: true });

    if (error) {
      console.error('Error fetching ingredients:', error);
      throw new Error(`Error fetching ingredients: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      nameEn: item.name_en || undefined,
      nameEs: item.name_es || undefined,
      pluralNameEn: item.plural_name_en || undefined,
      pluralNameEs: item.plural_name_es || undefined,
      pictureUrl: item.picture_url,
      nutritionalFacts: item.nutritional_facts
    }));
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
    
    // Handle English name fields
    if (ingredient.nameEn !== undefined) ingredientData.name_en = ingredient.nameEn;
    if (ingredient.pluralNameEn !== undefined) ingredientData.plural_name_en = ingredient.pluralNameEn;
    
    // Handle Spanish name fields
    if (ingredient.nameEs !== undefined) ingredientData.name_es = ingredient.nameEs;
    if (ingredient.pluralNameEs !== undefined) ingredientData.plural_name_es = ingredient.pluralNameEs;
    
    // Handle image update only if pictureUrl is explicitly provided and is different
    if (ingredient.pictureUrl !== undefined) {
      // First, get the current ingredient to get its image URL
      const { data: currentIngredient, error: fetchError } = await this.supabase
        .from('ingredients')
        .select('picture_url')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(`Error fetching current ingredient: ${fetchError.message}`);
      }

      // Only process image if it's actually different
      const isNewImage = typeof ingredient.pictureUrl === 'object';
      const isDifferentUrl = ingredient.pictureUrl !== currentIngredient?.picture_url;

      if (isNewImage || isDifferentUrl) {
        // If there's an existing image and we're updating to a new one, delete the old one
        if (currentIngredient?.picture_url) {
          try {
            await this.deleteImage(currentIngredient.picture_url);
          } catch (error) {
            console.error('Error deleting old image:', error);
            // Continue with update even if image deletion fails
          }
        }

        // If the new pictureUrl is a file object, upload it
        if (isNewImage) {
          ingredientData.picture_url = await this.handleImageUpload(
            ingredient.pictureUrl,
            ingredient.nameEs,
            ingredient.nameEn
          );
        } else {
          // If it's a different URL string, use it directly
          ingredientData.picture_url = ingredient.pictureUrl;
        }
      }
    }
    
    if (ingredient.nutritionalFacts !== undefined) ingredientData.nutritional_facts = ingredient.nutritionalFacts;

    // Only perform update if there are changes
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
    const ingredientData = {
      name_en: ingredient.nameEn,
      name_es: ingredient.nameEs,
      plural_name_en: ingredient.pluralNameEn,
      plural_name_es: ingredient.pluralNameEs,
      picture_url: '',
      nutritional_facts: ingredient.nutritionalFacts,
    };

    if (ingredient.pictureUrl) {
      ingredientData.picture_url = await this.handleImageUpload(
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
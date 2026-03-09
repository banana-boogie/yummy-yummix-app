import { supabase } from '@/lib/supabase';
import { BaseService } from '../base/BaseService';
import { imageService } from '../storage/imageService';
import { AdminUsefulItem } from '@/types/recipe.admin.types';

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

export class AdminUsefulItemsService extends BaseService {
  constructor() {
    super(supabase);
  }

  async getAllUsefulItems(sortBy: 'name_en' | 'name_es' = 'name_en'): Promise<AdminUsefulItem[]> {
    const { data, error } = await this.supabase
      .from('useful_items')
      .select(`
        id,
        image_url,
        translations:useful_item_translations (
          locale,
          name
        )
      `)
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Error fetching useful items: ${error.message}`);
    }

    const result = (data || []).map((item: any) => {
      const en = pickByLocale(item.translations, 'en');
      const es = pickByLocale(item.translations, 'es');
      return {
        id: item.id,
        nameEn: en?.name || '',
        nameEs: es?.name || '',
        pictureUrl: item.image_url || item.imageUrl || '',
      };
    });

    // Sort client-side since translation table columns can't be sorted via PostgREST
    result.sort((a: AdminUsefulItem, b: AdminUsefulItem) => {
      const aVal = sortBy === 'name_es' ? (a.nameEs || '') : (a.nameEn || '');
      const bVal = sortBy === 'name_es' ? (b.nameEs || '') : (b.nameEn || '');
      return aVal.localeCompare(bVal);
    });

    return result;
  }

  private async handleImageUpload(file: any, nameEn?: string, nameEs?: string): Promise<string> {
    if (!file) return '';

    try {
      const fileName = `${nameEn || nameEs || 'useful-item'}.png`;
      return await this.uploadImage({
        bucket: 'useful-items',
        folderPath: 'images',
        fileName,
        file,
        forcePNG: true
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Error uploading image: ${error}`);
    }
  }

  // Writes continue using old _en/_es columns (sync triggers handle translation tables)
  async updateUsefulItem(id: string, item: AdminUsefulItem): Promise<AdminUsefulItem> {
    const itemData: Record<string, any> = {};

    if (item.nameEn !== undefined) itemData.name_en = item.nameEn;
    if (item.nameEs !== undefined) itemData.name_es = item.nameEs;

    if (item.pictureUrl !== undefined) {
      const { data: currentItem, error: fetchError } = await this.supabase
        .from('useful_items')
        .select('image_url')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(`Error fetching current useful item: ${fetchError.message}`);
      }

      const isNewImage = typeof item.pictureUrl === 'object';
      const isDifferentUrl = item.pictureUrl !== currentItem?.image_url;

      if (isNewImage || isDifferentUrl) {
        if (currentItem?.image_url) {
          try {
            await this.deleteImage(currentItem.image_url);
          } catch (error) {
            console.error('Error deleting old image:', error);
          }
        }

        if (isNewImage) {
          itemData.image_url = await this.handleImageUpload(
            item.pictureUrl,
            item.nameEn,
            item.nameEs
          );
        } else {
          itemData.image_url = item.pictureUrl;
        }
      }
    }

    if (Object.keys(itemData).length > 0) {
      const updatedItem = await this.transformedUpdate<AdminUsefulItem>('useful_items', id, itemData);
      if (!updatedItem) {
        throw new Error('Failed to update useful item');
      }
      return updatedItem;
    }

    return item;
  }

  async deleteUsefulItem(id: string): Promise<void> {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid useful item ID provided');
    }

    try {
        const { data: currentItem, error: fetchError } = await this.supabase
        .from('useful_items')
        .select('image_url')
        .eq('id', id)
        .single();

        if (currentItem?.image_url) {
          await this.deleteImage(currentItem.image_url);
        }
        if (fetchError) {
          console.error('Error fetching current useful item:', fetchError);
        }
      } catch (error) {
        console.error('Error deleting old image:', error);
      }

    const { error } = await this.supabase
      .from('useful_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting useful item:', error);
      throw new Error(`Error deleting useful item: ${error.message}`);
    }
  }

  async createUsefulItem(item: AdminUsefulItem): Promise<AdminUsefulItem> {
    const itemData = {
      name_en: item.nameEn,
      name_es: item.nameEs,
      image_url: '',
    };

    if (item.pictureUrl) {
      itemData.image_url = await this.handleImageUpload(
        item.pictureUrl,
        item.nameEn,
        item.nameEs
      );
    }

    const result = await this.transformedInsert<AdminUsefulItem>('useful_items', itemData);
    return result;
  }

  // Image methods
  uploadImage = imageService.uploadImage.bind(imageService);
  deleteImage = imageService.deleteImage.bind(imageService);
}

export const adminUsefulItemsService = new AdminUsefulItemsService();
export default adminUsefulItemsService;

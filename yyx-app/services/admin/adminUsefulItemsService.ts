import { supabase } from '@/lib/supabase';
import { BaseService } from '../base/BaseService';
import { imageService } from '../storage/imageService';
import { AdminUsefulItem, AdminUsefulItemTranslation, pickTranslation, getNameFromTranslations } from '@/types/recipe.admin.types';

export class AdminUsefulItemsService extends BaseService {
  constructor() {
    super(supabase);
  }

  async getAllUsefulItems(sortBy: 'en' | 'es' = 'en'): Promise<AdminUsefulItem[]> {
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

    const result: AdminUsefulItem[] = (data || []).map((item: any) => ({
      id: item.id,
      translations: (item.translations || []).map((t: any) => ({
        locale: t.locale,
        name: t.name || '',
      })),
      pictureUrl: item.image_url || item.imageUrl || '',
    }));

    // Sort client-side since translation table columns can't be sorted via PostgREST
    const sortLocale = sortBy;
    result.sort((a: AdminUsefulItem, b: AdminUsefulItem) => {
      const aName = pickTranslation(a.translations, sortLocale)?.name || '';
      const bName = pickTranslation(b.translations, sortLocale)?.name || '';
      return aName.localeCompare(bName);
    });

    return result;
  }

  private async handleImageUpload(file: any, translations?: AdminUsefulItemTranslation[]): Promise<string> {
    if (!file) return '';

    try {
      const fileName = `${getNameFromTranslations(translations, 'useful-item')}.png`;
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

  async updateUsefulItem(id: string, item: AdminUsefulItem): Promise<AdminUsefulItem> {
    const itemData: Record<string, any> = {};

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
            item.translations
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
    }

    // Upsert translations from the translations array
    if (item.translations && item.translations.length > 0) {
      const dbTranslations = item.translations.map(t => ({
        useful_item_id: id,
        locale: t.locale,
        name: t.name,
      }));

      const { error: translationError } = await this.supabase
        .from('useful_item_translations')
        .upsert(dbTranslations, { onConflict: 'useful_item_id,locale' });

      if (translationError) {
        throw new Error(`Failed to upsert useful item translations: ${translationError.message}`);
      }
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
    const translations: AdminUsefulItemTranslation[] = item.translations || [];

    const itemData: Record<string, any> = {
      image_url: '',
    };

    if (item.pictureUrl) {
      itemData.image_url = await this.handleImageUpload(
        item.pictureUrl,
        translations
      );
    }

    // Insert the useful item and get the ID back
    const { data: inserted, error: insertError } = await this.supabase
      .from('useful_items')
      .insert(itemData)
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create useful item: ${insertError.message}`);
    }

    // Insert translations from the translations array
    const dbTranslations = translations.map(t => ({
      useful_item_id: inserted.id,
      locale: t.locale,
      name: t.name,
    }));

    if (dbTranslations.length > 0) {
      const { error: translationError } = await this.supabase
        .from('useful_item_translations')
        .insert(dbTranslations);

      if (translationError) {
        throw new Error(`Failed to insert useful item translations: ${translationError.message}`);
      }
    }

    return {
      id: inserted.id,
      translations,
      pictureUrl: itemData.image_url,
    };
  }

  // Image methods
  uploadImage = imageService.uploadImage.bind(imageService);
  deleteImage = imageService.deleteImage.bind(imageService);
}

export const adminUsefulItemsService = new AdminUsefulItemsService();
export default adminUsefulItemsService;

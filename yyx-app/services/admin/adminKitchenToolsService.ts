import { supabase } from '@/lib/supabase';
import { BaseService } from '../base/BaseService';
import { imageService } from '../storage/imageService';
import { AdminKitchenTool, AdminKitchenToolTranslation, pickTranslation, getNameFromTranslations } from '@/types/recipe.admin.types';
import logger from '@/services/logger';

export class AdminKitchenToolsService extends BaseService {
  constructor() {
    super(supabase);
  }

  async getAllKitchenTools(sortBy: 'en' | 'es' = 'en'): Promise<AdminKitchenTool[]> {
    const { data, error } = await this.supabase
      .from('kitchen_tools')
      .select(`
        id,
        image_url,
        translations:kitchen_tool_translations (
          locale,
          name
        )
      `)
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Error fetching kitchen tools: ${error.message}`);
    }

    const result: AdminKitchenTool[] = (data || []).map((item: any) => ({
      id: item.id,
      translations: (item.translations || []).map((t: any) => ({
        locale: t.locale,
        name: t.name || '',
      })),
      pictureUrl: item.image_url || item.imageUrl || '',
    }));

    // Sort client-side since translation table columns can't be sorted via PostgREST
    const sortLocale = sortBy;
    result.sort((a: AdminKitchenTool, b: AdminKitchenTool) => {
      const aName = pickTranslation(a.translations, sortLocale)?.name || '';
      const bName = pickTranslation(b.translations, sortLocale)?.name || '';
      return aName.localeCompare(bName);
    });

    return result;
  }

  private async handleImageUpload(file: any, translations?: AdminKitchenToolTranslation[]): Promise<string> {
    if (!file) return '';

    try {
      const fileName = `${getNameFromTranslations(translations, 'kitchen-tool')}.png`;
      return await this.uploadImage({
        bucket: 'kitchen-tools',
        folderPath: 'images',
        fileName,
        file,
        forcePNG: true
      });
    } catch (error) {
      logger.error('Error uploading image:', error);
      throw new Error(`Error uploading image: ${error}`);
    }
  }

  async updateKitchenTool(id: string, item: AdminKitchenTool): Promise<AdminKitchenTool> {
    const itemData: Record<string, any> = {};

    if (item.pictureUrl !== undefined) {
      const { data: currentItem, error: fetchError } = await this.supabase
        .from('kitchen_tools')
        .select('image_url')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(`Error fetching current kitchen tool: ${fetchError.message}`);
      }

      const isNewImage = typeof item.pictureUrl === 'object';
      const isDifferentUrl = item.pictureUrl !== currentItem?.image_url;

      if (isNewImage || isDifferentUrl) {
        if (currentItem?.image_url) {
          try {
            await this.deleteImage(currentItem.image_url);
          } catch (error) {
            logger.error('Error deleting old image:', error);
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
      const updatedItem = await this.transformedUpdate<AdminKitchenTool>('kitchen_tools', id, itemData);
      if (!updatedItem) {
        throw new Error('Failed to update kitchen tool');
      }
    }

    // Upsert translations from the translations array
    if (item.translations && item.translations.length > 0) {
      const dbTranslations = item.translations.map(t => ({
        kitchen_tool_id: id,
        locale: t.locale,
        name: t.name,
      }));

      const { error: translationError } = await this.supabase
        .from('kitchen_tool_translations')
        .upsert(dbTranslations, { onConflict: 'kitchen_tool_id,locale' });

      if (translationError) {
        if (translationError.message?.includes('unique constraint') || translationError.code === '23505') {
          throw new Error('A kitchen tool with this name already exists. Please use a different name.');
        }
        throw new Error(`Failed to upsert kitchen tool translations: ${translationError.message}`);
      }
    }

    return item;
  }

  async deleteKitchenTool(id: string): Promise<void> {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid kitchen tool ID provided');
    }

    try {
        const { data: currentItem, error: fetchError } = await this.supabase
        .from('kitchen_tools')
        .select('image_url')
        .eq('id', id)
        .single();

        if (currentItem?.image_url) {
          await this.deleteImage(currentItem.image_url);
        }
        if (fetchError) {
          logger.error('Error fetching current kitchen tool:', fetchError);
        }
      } catch (error) {
        logger.error('Error deleting old image:', error);
      }

    const { error } = await this.supabase
      .from('kitchen_tools')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting kitchen tool:', error);
      throw new Error(`Error deleting kitchen tool: ${error.message}`);
    }
  }

  async createKitchenTool(item: AdminKitchenTool): Promise<AdminKitchenTool> {
    const translations: AdminKitchenToolTranslation[] = item.translations || [];

    const itemData: Record<string, any> = {
      image_url: '',
    };

    if (item.pictureUrl) {
      itemData.image_url = await this.handleImageUpload(
        item.pictureUrl,
        translations
      );
    }

    // Insert the kitchen tool and get the ID back
    const { data: inserted, error: insertError } = await this.supabase
      .from('kitchen_tools')
      .insert(itemData)
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create kitchen tool: ${insertError.message}`);
    }

    // Insert translations from the translations array
    const dbTranslations = translations.map(t => ({
      kitchen_tool_id: inserted.id,
      locale: t.locale,
      name: t.name,
    }));

    if (dbTranslations.length > 0) {
      const { error: translationError } = await this.supabase
        .from('kitchen_tool_translations')
        .insert(dbTranslations);

      if (translationError) {
        if (translationError.message?.includes('unique constraint') || translationError.code === '23505') {
          throw new Error('A kitchen tool with this name already exists. Please use a different name.');
        }
        throw new Error(`Failed to insert kitchen tool translations: ${translationError.message}`);
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

export const adminKitchenToolsService = new AdminKitchenToolsService();
export default adminKitchenToolsService;

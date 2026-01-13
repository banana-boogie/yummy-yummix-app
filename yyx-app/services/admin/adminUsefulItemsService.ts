import { supabase } from '@/lib/supabase';
import { BaseService } from '../base/BaseService';
import { imageService } from '../storage/imageService';
import { AdminUsefulItem } from '@/types/recipe.admin.types';

export class AdminUsefulItemsService extends BaseService {
  constructor() {
    super(supabase);
  }

  async getAllUsefulItems(sortBy: 'name_en' | 'name_es' = 'name_en'): Promise<AdminUsefulItem[]> {
      return this.transformedSelect<AdminUsefulItem[]>(this.supabase
        .from('useful_items')
        .select('*')
        .order(sortBy, { ascending: true }));
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

  async updateUsefulItem(id: string, item: AdminUsefulItem): Promise<AdminUsefulItem> {
    const itemData: Record<string, any> = {};
    
    if (item.nameEn !== undefined) itemData.name_en = item.nameEn;
    if (item.nameEs !== undefined) itemData.name_es = item.nameEs;
    
    // Handle image update only if pictureUrl is explicitly provided and is different
    if (item.pictureUrl !== undefined) {
      // First, get the current item to get its image URL
      const { data: currentItem, error: fetchError } = await this.supabase
        .from('useful_items')
        .select('picture_url')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(`Error fetching current useful item: ${fetchError.message}`);
      }

      // Only process image if it's actually different
      const isNewImage = typeof item.pictureUrl === 'object';
      const isDifferentUrl = item.pictureUrl !== currentItem?.picture_url;

      if (isNewImage || isDifferentUrl) {
        // If there's an existing image and we're updating to a new one, delete the old one
        if (currentItem?.picture_url) {
          try {
            await this.deleteImage(currentItem.picture_url);
          } catch (error) {
            console.error('Error deleting old image:', error);
            // Continue with update even if image deletion fails
          }
        }

        // If the new pictureUrl is a file object, upload it
        if (isNewImage) {
          itemData.picture_url = await this.handleImageUpload(
            item.pictureUrl,
            item.nameEn,
            item.nameEs
          );
        } else {
          // If it's a different URL string, use it directly
          itemData.picture_url = item.pictureUrl;
        }
      }
    }

    // Only perform update if there are changes
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
        .select('picture_url')
        .eq('id', id)
        .single();

        if (currentItem?.picture_url) {
          await this.deleteImage(currentItem.picture_url);
        }
        if (fetchError) {
          console.error('Error fetching current useful item:', fetchError);
        }
      } catch (error) {
        console.error('Error deleting old image:', error);
        // Continue with update even if image deletion fails
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
      picture_url: '',
    };

    if (item.pictureUrl) {
      itemData.picture_url = await this.handleImageUpload(
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
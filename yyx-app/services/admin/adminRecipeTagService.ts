import { supabase } from '@/lib/supabase';
import { BaseService } from '@/services/base/BaseService';
import { AdminRecipeTag } from '@/types/recipe.admin.types';
import { formatCategoryNameToTitleCase, formatToScreamingSnakeCase, transformCategories } from '@/utils/formatters';
export interface TagFilters {
  searchQuery?: string;
  sortDirection?: 'asc' | 'desc';
}

class AdminRecipeTagService extends BaseService {
  constructor() {
    super(supabase);
  }

  async getAllTags(): Promise<AdminRecipeTag[]> {
    const tags = await this.transformedSelect<AdminRecipeTag[]>(
      this.supabase
        .from('recipe_tags')
        .select(`
          id,
          name_en,
          name_es,
          categories
        `)
        .order('name_es', { ascending: true })
    );

    // Transform categories for display
    return tags.map(tag => ({
      ...tag,
      categories: transformCategories.toDisplay(tag.categories || [])
    }));
  }

  async getTagCategories(): Promise<string[]> {
    const { data, error } = await this.supabase
      .rpc('get_enum_values', { enum_name: 'recipe_tag_category' });

    if (error) {
      throw new Error(`Failed to fetch enum values: ${error.message}`);
    }

    // The function returns an array of objects with an enum_value property
    return data?.map((item: { enum_value: string }) => formatCategoryNameToTitleCase(item.enum_value)).sort() || [];
  }

  async createCategory(category: string): Promise<void> {
    const { error } = await this.supabase
      .rpc('add_enum_value', { 
        enum_name: 'recipe_tag_category',
        new_value: formatToScreamingSnakeCase(category)
      });

    if (error) {
      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  async createTag(tag: Omit<AdminRecipeTag, 'id'>): Promise<AdminRecipeTag> {
    if (!tag) {
      throw new Error('No tag data provided');
    }

    if (!tag.categories) {
      throw new Error('No categories provided');
    }

    if (!tag.nameEn || !tag.nameEs) {
      throw new Error('No name provided');
    }

    if (tag.categories.length) {
      tag.categories = tag.categories.map(formatToScreamingSnakeCase);
    }
    
    const result = await this.transformedInsert<AdminRecipeTag>('recipe_tags', tag);
    if (result) {
      return {
        ...result,
        categories: transformCategories.toDisplay(result.categories || [])
      };
    }
    
    throw new Error('Failed to create tag: No data returned');
  }

  async updateTag(id: string, tag: Partial<Omit<AdminRecipeTag, 'id'>>): Promise<AdminRecipeTag> {
    if (!tag) {
      throw new Error('No tag data provided');
    }

    if (!tag.categories) {
      throw new Error('No categories provided');
    }

    if (!tag.nameEn || !tag.nameEs) {
      throw new Error('No name provided');
    }

    // Create a copy with transformed categories
    const dbTag = {
      ...tag,
      categories: tag.categories ? transformCategories.toDatabase(tag.categories) : undefined
    };

    const result = await this.transformedUpdate<AdminRecipeTag>('recipe_tags', id, dbTag);
    
    // Transform result back to display format
    if (result) {
      return {
        ...result,
        categories: transformCategories.toDisplay(result.categories || [])
      };
    }
    throw new Error('Failed to update tag: No data returned');
  }

  async deleteTag(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('recipe_tags')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete tag: ${error.message}`);
    }
  }
}

export const adminRecipeTagService = new AdminRecipeTagService();
export default adminRecipeTagService; 
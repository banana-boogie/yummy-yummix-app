import { supabase } from '@/lib/supabase';
import { BaseService } from '@/services/base/BaseService';
import { AdminRecipeTag } from '@/types/recipe.admin.types';
import { formatCategoryNameToTitleCase, formatToScreamingSnakeCase, transformCategories } from '@/utils/formatters';
export interface TagFilters {
  searchQuery?: string;
  sortDirection?: 'asc' | 'desc';
}

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

class AdminRecipeTagService extends BaseService {
  constructor() {
    super(supabase);
  }

  async getAllTags(): Promise<AdminRecipeTag[]> {
    const { data, error } = await this.supabase
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

    if (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }

    // Transform to admin format
    const tags = (data || []).map((item: any) => {
      const en = pickByLocale(item.translations, 'en');
      const es = pickByLocale(item.translations, 'es');
      return {
        id: item.id,
        nameEn: en?.name || '',
        nameEs: es?.name || '',
        categories: transformCategories.toDisplay(item.categories || []),
      };
    });

    // Sort by Spanish name (matching previous behavior)
    tags.sort((a: AdminRecipeTag, b: AdminRecipeTag) =>
      (a.nameEs || '').localeCompare(b.nameEs || '')
    );

    return tags;
  }

  async getTagCategories(): Promise<string[]> {
    const { data, error } = await this.supabase
      .rpc('get_enum_values', { enum_name: 'recipe_tag_category' });

    if (error) {
      throw new Error(`Failed to fetch enum values: ${error.message}`);
    }

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

  // Writes continue using old _en/_es columns (sync triggers handle translation tables)
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

    const dbTag = {
      ...tag,
      categories: tag.categories ? transformCategories.toDatabase(tag.categories) : undefined
    };

    const result = await this.transformedUpdate<AdminRecipeTag>('recipe_tags', id, dbTag);

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

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

    const categories = tag.categories.length
      ? tag.categories.map(formatToScreamingSnakeCase)
      : [];

    // Insert only non-translatable fields into recipe_tags
    const { data: inserted, error: insertError } = await this.supabase
      .from('recipe_tags')
      .insert({ categories })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create tag: ${insertError.message}`);
    }

    if (!inserted) {
      throw new Error('Failed to create tag: No data returned');
    }

    // Insert translations for both locales
    const translations = [
      { recipe_tag_id: inserted.id, locale: 'en', name: tag.nameEn },
      { recipe_tag_id: inserted.id, locale: 'es', name: tag.nameEs },
    ];

    const { error: translationError } = await this.supabase
      .from('recipe_tag_translations')
      .insert(translations);

    if (translationError) {
      throw new Error(`Failed to insert tag translations: ${translationError.message}`);
    }

    return {
      id: inserted.id,
      nameEn: tag.nameEn,
      nameEs: tag.nameEs,
      categories: transformCategories.toDisplay(categories),
    };
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

    // Update only non-translatable fields on recipe_tags
    const categories = tag.categories ? transformCategories.toDatabase(tag.categories) : [];

    const { error: updateError } = await this.supabase
      .from('recipe_tags')
      .update({ categories })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Failed to update tag: ${updateError.message}`);
    }

    // Upsert translations for both locales
    const translations = [
      { recipe_tag_id: id, locale: 'en', name: tag.nameEn },
      { recipe_tag_id: id, locale: 'es', name: tag.nameEs },
    ];

    const { error: translationError } = await this.supabase
      .from('recipe_tag_translations')
      .upsert(translations, { onConflict: 'recipe_tag_id,locale' });

    if (translationError) {
      throw new Error(`Failed to upsert tag translations: ${translationError.message}`);
    }

    return {
      id,
      nameEn: tag.nameEn!,
      nameEs: tag.nameEs!,
      categories: transformCategories.toDisplay(categories),
    };
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

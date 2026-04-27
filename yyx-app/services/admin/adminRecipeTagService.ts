import { supabase } from '@/lib/supabase';
import { BaseService } from '@/services/base/BaseService';
import { AdminRecipeTag, pickTranslation } from '@/types/recipe.admin.types';

export const CANONICAL_TAG_CATEGORIES = [
  'cuisine',
  'meal_type',
  'diet',
  'occasion',
  'practical',
] as const;

export interface TagFilters {
  searchQuery?: string;
  sortDirection?: 'asc' | 'desc';
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
        slug,
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

    // Transform to admin format with translations arrays
    const tags: AdminRecipeTag[] = (data || []).map((item: any) => ({
      id: item.id,
      slug: item.slug ?? null,
      translations: (item.translations || []).map((t: any) => ({
        locale: t.locale,
        name: t.name || '',
      })),
      categories: item.categories || [],
    }));

    // Sort by Spanish name (matching previous behavior)
    tags.sort((a: AdminRecipeTag, b: AdminRecipeTag) => {
      const aName = pickTranslation(a.translations, 'es')?.name || '';
      const bName = pickTranslation(b.translations, 'es')?.name || '';
      return aName.localeCompare(bName);
    });

    return tags;
  }

  async getTagCategories(): Promise<string[]> {
    return [...CANONICAL_TAG_CATEGORIES];
  }

  async createCategory(category: string): Promise<void> {
    throw new Error(`Cannot create recipe tag category "${category}". Categories are product-defined.`);
  }

  async createTag(tag: Omit<AdminRecipeTag, 'id'>): Promise<AdminRecipeTag> {
    if (!tag) {
      throw new Error('No tag data provided');
    }

    if (!tag.categories) {
      throw new Error('No categories provided');
    }

    if (!tag.slug) {
      throw new Error('No slug provided');
    }

    if (!tag.translations || tag.translations.length === 0) {
      throw new Error('No translations provided');
    }

    const categories = tag.categories || [];

    // Insert only non-translatable fields into recipe_tags
    const { data: inserted, error: insertError } = await this.supabase
      .from('recipe_tags')
      .insert({ slug: tag.slug, categories })
      .select('id, slug')
      .single();

    if (insertError) {
      throw new Error(`Failed to create tag: ${insertError.message}`);
    }

    if (!inserted) {
      throw new Error('Failed to create tag: No data returned');
    }

    // Insert translations from the translations array
    const dbTranslations = tag.translations.map(t => ({
      recipe_tag_id: inserted.id,
      locale: t.locale,
      name: t.name,
    }));

    const { error: translationError } = await this.supabase
      .from('recipe_tag_translations')
      .insert(dbTranslations);

    if (translationError) {
      throw new Error(`Failed to insert tag translations: ${translationError.message}`);
    }

    return {
      id: inserted.id,
      slug: inserted.slug ?? tag.slug,
      translations: tag.translations,
      categories,
    };
  }

  async updateTag(id: string, tag: Partial<Omit<AdminRecipeTag, 'id'>>): Promise<AdminRecipeTag> {
    if (!tag) {
      throw new Error('No tag data provided');
    }

    if (!tag.categories) {
      throw new Error('No categories provided');
    }

    if (!tag.slug) {
      throw new Error('No slug provided');
    }

    if (!tag.translations || tag.translations.length === 0) {
      throw new Error('No translations provided');
    }

    // Update only non-translatable fields on recipe_tags
    const categories = tag.categories || [];

    const { error: updateError } = await this.supabase
      .from('recipe_tags')
      .update({ slug: tag.slug, categories })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Failed to update tag: ${updateError.message}`);
    }

    // Upsert translations from the translations array
    const dbTranslations = tag.translations.map(t => ({
      recipe_tag_id: id,
      locale: t.locale,
      name: t.name,
    }));

    const { error: translationError } = await this.supabase
      .from('recipe_tag_translations')
      .upsert(dbTranslations, { onConflict: 'recipe_tag_id,locale' });

    if (translationError) {
      throw new Error(`Failed to upsert tag translations: ${translationError.message}`);
    }

    return {
      id,
      slug: tag.slug,
      translations: tag.translations,
      categories,
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

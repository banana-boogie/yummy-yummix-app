import { supabase } from '@/lib/supabase';
import { adminRecipeService } from '@/services/admin/adminRecipeService';

// --- Types ---

export interface ContentHealthSummary {
  missingTranslations: { total: number; recipes: number; ingredients: number; usefulItems: number };
  missingImages: { total: number; recipes: number; ingredients: number; usefulItems: number };
  missingNutrition: { total: number; ingredients: number };
  unpublished: { total: number; recipes: number };
}

export type EntityType = 'recipe' | 'ingredient' | 'useful_item';

export interface ContentHealthIssue {
  id: string;
  entityType: EntityType;
  name: string;
  imageUrl: string | null;
  isPublished: boolean | null;
  stepCount: number | null;
  ingredientCount: number | null;
  missingEn: boolean;
  missingEs: boolean;
  missingImage: boolean;
  missingNutrition: boolean;
}

export interface ContentHealthData {
  summary: ContentHealthSummary;
  issues: ContentHealthIssue[];
}

export type IssueFilter = 'all' | 'translation' | 'image' | 'nutrition' | 'unpublished';
export type EntityFilter = 'all' | 'recipe' | 'ingredient' | 'useful_item';

// --- Service ---

export const adminContentHealthService = {
  async getContentHealth(): Promise<ContentHealthData> {
    const { data, error } = await supabase.rpc('admin_content_health');

    if (error) {
      throw new Error('Failed to fetch content health: ' + error.message);
    }

    return data as ContentHealthData;
  },

  async publishRecipe(id: string): Promise<void> {
    await adminRecipeService.toggleRecipePublished(id, true);
  },
};

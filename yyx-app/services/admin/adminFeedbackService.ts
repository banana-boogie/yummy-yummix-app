import { supabase } from '@/lib/supabase';
import { AdminFeedbackItem } from '@/types/rating.types';
import i18n from '@/i18n';

const getLangSuffix = () => `_${i18n.locale}`;

export interface FeedbackFilters {
    recipeId?: string;
    startDate?: string;
    endDate?: string;
}

export interface FeedbackListResult {
    data: AdminFeedbackItem[];
    count: number;
    hasMore: boolean;
}

/**
 * Admin service for managing recipe feedback
 */
export const adminFeedbackService = {
    /**
     * Get paginated list of all user feedback (admin only)
     */
    async getFeedback(
        filters: FeedbackFilters = {},
        page = 1,
        pageSize = 20
    ): Promise<FeedbackListResult> {
        const lang = getLangSuffix();
        const offset = (page - 1) * pageSize;

        let query = supabase
            .from('recipe_feedback')
            .select(`
        id,
        feedback,
        created_at,
        user_id,
        recipe_id,
        recipe:recipes!inner (
          id,
          name${lang}
        ),
        user:user_profiles!inner (
          id,
          email
        )
      `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1);

        // Apply filters
        if (filters.recipeId) {
            query = query.eq('recipe_id', filters.recipeId);
        }
        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
            query = query.lte('created_at', filters.endDate);
        }

        const { data, count, error } = await query;

        if (error) {
            throw new Error(`Failed to fetch feedback: ${error.message}`);
        }

        // Transform the data
        const transformedData: AdminFeedbackItem[] = (data || []).map((item: any) => ({
            id: item.id,
            feedback: item.feedback,
            createdAt: item.created_at,
            recipeId: item.recipe_id,
            recipeName: item.recipe?.[`name${lang}`] || 'Unknown Recipe',
            userId: item.user_id,
            userEmail: item.user?.email || 'Unknown User',
        }));

        return {
            data: transformedData,
            count: count || 0,
            hasMore: offset + pageSize < (count || 0),
        };
    },

    /**
     * Get list of recipes for filter dropdown
     */
    async getRecipesForFilter(): Promise<Array<{ id: string; name: string }>> {
        const lang = getLangSuffix();

        const { data, error } = await supabase
            .from('recipes')
            .select(`id, name${lang}`)
            .eq('is_published', true)
            .order(`name${lang}`);

        if (error) {
            throw new Error(`Failed to fetch recipes: ${error.message}`);
        }

        return (data || []).map((recipe: any) => ({
            id: recipe.id,
            name: recipe[`name${lang}`],
        }));
    },
};

export default adminFeedbackService;

import { supabase } from '@/lib/supabase';
import { AdminFeedbackItem } from '@/types/rating.types';

interface FeedbackRpcRow {
    id: string;
    feedback: string;
    created_at: string;
    user_id: string;
    recipe_id: string;
    recipe_name: string | null;
    user_email: string | null;
}

interface FeedbackRpcResult {
    data: FeedbackRpcRow[];
    count: number;
    hasMore: boolean;
}

interface RawRecipeRow {
    id: string;
    [key: string]: string;
}

export interface FeedbackFilters {
    recipeId?: string;
    startDate?: string;
    endDate?: string;
    language?: 'en' | 'es';
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
        const language = filters.language || 'en';
        const { data, error } = await supabase.rpc('admin_recipe_feedback_list', {
            p_page: page,
            p_page_size: pageSize,
            p_recipe_id: filters.recipeId ?? null,
            p_start_date: filters.startDate ?? null,
            p_end_date: filters.endDate ?? null,
            p_language: language,
        });

        if (error) {
            throw new Error(`Failed to fetch feedback: ${error.message}`);
        }

        const payload = (data as FeedbackRpcResult | null) ?? {
            data: [],
            count: 0,
            hasMore: false,
        };

        const transformedData: AdminFeedbackItem[] = payload.data.map((item) => ({
            id: item.id,
            feedback: item.feedback,
            createdAt: item.created_at,
            recipeId: item.recipe_id,
            recipeName: item.recipe_name || 'Unknown Recipe',
            userId: item.user_id,
            userEmail: item.user_email || 'Unknown User',
        }));

        return {
            data: transformedData,
            count: payload.count || 0,
            hasMore: payload.hasMore || false,
        };
    },

    /**
     * Get list of recipes for filter dropdown
     */
    async getRecipesForFilter(language: 'en' | 'es' = 'en'): Promise<{ id: string; name: string }[]> {
        const nameColumn = language === 'es' ? 'name_es' : 'name_en';

        const { data, error } = await supabase
            .from('recipes')
            .select(`id, ${nameColumn}`)
            .eq('is_published', true)
            .order(nameColumn);

        if (error) {
            throw new Error(`Failed to fetch recipes: ${error.message}`);
        }

        return ((data || []) as RawRecipeRow[]).map((recipe) => ({
            id: recipe.id,
            name: recipe[nameColumn],
        }));
    },
};

export default adminFeedbackService;

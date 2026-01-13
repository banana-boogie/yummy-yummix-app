// Rating and feedback types for recipe rating feature

export interface RecipeRating {
    id: string;
    userId: string;
    recipeId: string;
    rating: number; // 1-5
    createdAt: string;
    updatedAt: string;
}

export interface RecipeFeedback {
    id: string;
    userId: string;
    recipeId: string;
    feedback: string;
    createdAt: string;
}

export interface RecipeCompletion {
    id: string;
    userId: string;
    recipeId: string;
    completionCount: number;
    firstCompletedAt: string;
    lastCompletedAt: string;
}

export interface RecipeRatingStats {
    averageRating: number | null;
    ratingCount: number;
}

// Raw API response types (snake_case from Supabase)
export interface RawRecipeRating {
    id: string;
    user_id: string;
    recipe_id: string;
    rating: number;
    created_at: string;
    updated_at: string;
}

export interface RawRecipeFeedback {
    id: string;
    user_id: string;
    recipe_id: string;
    feedback: string;
    created_at: string;
}

export interface RawRecipeCompletion {
    id: string;
    user_id: string;
    recipe_id: string;
    completion_count: number;
    first_completed_at: string;
    last_completed_at: string;
}

// Admin feedback view with joined data
export interface AdminFeedbackItem {
    id: string;
    feedback: string;
    createdAt: string;
    recipeName: string;
    recipeId: string;
    userEmail: string;
    userId: string;
}

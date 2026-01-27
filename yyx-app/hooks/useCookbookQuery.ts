import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationOptions,
} from '@tanstack/react-query';
import { cookbookService } from '@/services/cookbookService';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Cookbook,
  CookbookWithRecipes,
  CreateCookbookInput,
  UpdateCookbookInput,
  AddRecipeToCookbookInput,
  UpdateCookbookRecipeInput,
} from '@/types/cookbook.types';

// ============================================================================
// Query Keys
// ============================================================================

export const cookbookKeys = {
  all: ['cookbooks'] as const,
  lists: () => [...cookbookKeys.all, 'list'] as const,
  list: (userId: string, language: string) =>
    [...cookbookKeys.lists(), userId, language] as const,
  details: () => [...cookbookKeys.all, 'detail'] as const,
  detail: (id: string, language: string) =>
    [...cookbookKeys.details(), id, language] as const,
  shared: (token: string, language: string) =>
    [...cookbookKeys.all, 'shared', token, language] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all cookbooks for the current user
 *
 * Features:
 * - Automatic caching per user and language
 * - Auto-creates default "Favorites" cookbook on first access
 * - Loading and error states built-in
 */
export function useUserCookbooksQuery() {
  const { user } = useAuth();
  const { language } = useLanguage();

  return useQuery({
    queryKey: cookbookKeys.list(user?.id || '', language),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Ensure default cookbook exists
      await cookbookService.ensureDefaultCookbook(user.id);

      // Fetch all cookbooks
      return await cookbookService.getUserCookbooks(user.id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single cookbook by ID with all recipes
 */
export function useCookbookQuery(cookbookId: string) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: cookbookKeys.detail(cookbookId, language),
    queryFn: async () => {
      return await cookbookService.getCookbookById(cookbookId);
    },
    enabled: !!cookbookId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a shared cookbook by token (for unauthenticated users)
 */
export function useSharedCookbookQuery(shareToken: string) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: cookbookKeys.shared(shareToken, language),
    queryFn: async () => {
      return await cookbookService.getCookbookByShareToken(shareToken);
    },
    enabled: !!shareToken,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch cookbooks that contain a specific recipe
 * Returns minimal cookbook info for display on recipe detail page
 */
export function useCookbooksContainingRecipe(recipeId: string) {
  const { user } = useAuth();
  const { language } = useLanguage();

  return useQuery({
    queryKey: [...cookbookKeys.all, 'containing', recipeId, user?.id, language],
    queryFn: async () => {
      if (!user?.id || !recipeId) {
        return [];
      }
      const ids = await cookbookService.getCookbookIdsContainingRecipe(
        user.id,
        recipeId
      );
      if (ids.length === 0) return [];

      // Fetch cookbook details for these IDs
      const cookbooks = await cookbookService.getUserCookbooks(user.id);
      return cookbooks.filter((cb) => ids.includes(cb.id));
    },
    enabled: !!user?.id && !!recipeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new cookbook
 */
export function useCreateCookbook() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCookbookInput) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return await cookbookService.createCookbook(user.id, input);
    },
    onSuccess: () => {
      // Invalidate the list query to refetch
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: cookbookKeys.list(user.id, language),
        });
      }
    },
  });
}

/**
 * Hook to update a cookbook
 */
export function useUpdateCookbook() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cookbookId,
      input,
    }: {
      cookbookId: string;
      input: UpdateCookbookInput;
    }) => {
      return await cookbookService.updateCookbook(cookbookId, input);
    },
    onSuccess: (_, variables) => {
      // Invalidate both list and detail queries
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: cookbookKeys.list(user.id, language),
        });
      }
      queryClient.invalidateQueries({
        queryKey: cookbookKeys.detail(variables.cookbookId, language),
      });
    },
  });
}

/**
 * Hook to delete a cookbook
 * Includes optimistic update for immediate UI feedback
 */
export function useDeleteCookbook() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cookbookId: string) => {
      return await cookbookService.deleteCookbook(cookbookId);
    },
    onMutate: async (cookbookId: string) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: cookbookKeys.list(user?.id || '', language),
      });

      // Snapshot previous value
      const previousCookbooks = queryClient.getQueryData<Cookbook[]>(
        cookbookKeys.list(user?.id || '', language)
      );

      // Optimistically remove the cookbook
      if (previousCookbooks) {
        queryClient.setQueryData(
          cookbookKeys.list(user?.id || '', language),
          previousCookbooks.filter((cb) => cb.id !== cookbookId)
        );
      }

      return { previousCookbooks };
    },
    onError: (_err, _cookbookId, context) => {
      // Rollback on error
      if (context?.previousCookbooks && user?.id) {
        queryClient.setQueryData(
          cookbookKeys.list(user.id, language),
          context.previousCookbooks
        );
      }
    },
    onSettled: () => {
      // Invalidate the list query to refetch latest
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: cookbookKeys.list(user.id, language),
        });
      }
    },
  });
}

/**
 * Hook to add a recipe to a cookbook
 * Includes optimistic update for recipe count
 */
export function useAddRecipeToCookbook() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddRecipeToCookbookInput) => {
      return await cookbookService.addRecipeToCookbook(input);
    },
    onMutate: async (input: AddRecipeToCookbookInput) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: cookbookKeys.list(user?.id || '', language),
      });

      // Snapshot previous value
      const previousCookbooks = queryClient.getQueryData<Cookbook[]>(
        cookbookKeys.list(user?.id || '', language)
      );

      // Optimistically update the recipe count
      if (previousCookbooks) {
        queryClient.setQueryData(
          cookbookKeys.list(user?.id || '', language),
          previousCookbooks.map((cb) =>
            cb.id === input.cookbookId
              ? { ...cb, recipeCount: cb.recipeCount + 1 }
              : cb
          )
        );
      }

      return { previousCookbooks };
    },
    onError: (_err, _input, context) => {
      // Rollback on error
      if (context?.previousCookbooks && user?.id) {
        queryClient.setQueryData(
          cookbookKeys.list(user.id, language),
          context.previousCookbooks
        );
      }
    },
    onSettled: (_, __, variables) => {
      // Invalidate both list (to update recipe count) and detail queries
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: cookbookKeys.list(user.id, language),
        });
      }
      queryClient.invalidateQueries({
        queryKey: cookbookKeys.detail(variables.cookbookId, language),
      });
      // Also invalidate containing recipe query
      queryClient.invalidateQueries({
        queryKey: [...cookbookKeys.all, 'containing', variables.recipeId],
      });
    },
  });
}

/**
 * Hook to remove a recipe from a cookbook
 * Includes optimistic update for immediate UI feedback
 */
export function useRemoveRecipeFromCookbook() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cookbookId,
      recipeId,
    }: {
      cookbookId: string;
      recipeId: string;
    }) => {
      return await cookbookService.removeRecipeFromCookbook(cookbookId, recipeId);
    },
    onMutate: async ({ cookbookId, recipeId }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: cookbookKeys.list(user?.id || '', language),
      });
      await queryClient.cancelQueries({
        queryKey: cookbookKeys.detail(cookbookId, language),
      });

      // Snapshot previous values
      const previousCookbooks = queryClient.getQueryData<Cookbook[]>(
        cookbookKeys.list(user?.id || '', language)
      );
      const previousCookbookDetail =
        queryClient.getQueryData<CookbookWithRecipes>(
          cookbookKeys.detail(cookbookId, language)
        );

      // Optimistically update the recipe count in list
      if (previousCookbooks) {
        queryClient.setQueryData(
          cookbookKeys.list(user?.id || '', language),
          previousCookbooks.map((cb) =>
            cb.id === cookbookId
              ? { ...cb, recipeCount: Math.max(0, cb.recipeCount - 1) }
              : cb
          )
        );
      }

      // Optimistically remove the recipe from detail view
      if (previousCookbookDetail) {
        queryClient.setQueryData(cookbookKeys.detail(cookbookId, language), {
          ...previousCookbookDetail,
          recipeCount: Math.max(0, previousCookbookDetail.recipeCount - 1),
          recipes: previousCookbookDetail.recipes.filter(
            (r) => r.id !== recipeId
          ),
        });
      }

      return { previousCookbooks, previousCookbookDetail };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousCookbooks && user?.id) {
        queryClient.setQueryData(
          cookbookKeys.list(user.id, language),
          context.previousCookbooks
        );
      }
      if (context?.previousCookbookDetail) {
        queryClient.setQueryData(
          cookbookKeys.detail(variables.cookbookId, language),
          context.previousCookbookDetail
        );
      }
    },
    onSettled: (_, __, variables) => {
      // Invalidate both list and detail queries
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: cookbookKeys.list(user.id, language),
        });
      }
      queryClient.invalidateQueries({
        queryKey: cookbookKeys.detail(variables.cookbookId, language),
      });
      // Also invalidate containing recipe query
      queryClient.invalidateQueries({
        queryKey: [...cookbookKeys.all, 'containing', variables.recipeId],
      });
    },
  });
}

/**
 * Hook to update recipe notes/order in a cookbook
 */
export function useUpdateCookbookRecipe() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cookbookId,
      cookbookRecipeId,
      input,
    }: {
      cookbookId: string;
      cookbookRecipeId: string;
      input: UpdateCookbookRecipeInput;
    }) => {
      return await cookbookService.updateCookbookRecipe(cookbookRecipeId, input);
    },
    onSuccess: (_, variables) => {
      // Invalidate detail query
      queryClient.invalidateQueries({
        queryKey: cookbookKeys.detail(variables.cookbookId, language),
      });
    },
  });
}

/**
 * Hook to regenerate share token for a cookbook
 */
export function useRegenerateShareToken() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cookbookId: string) => {
      return await cookbookService.regenerateShareToken(cookbookId);
    },
    onSuccess: (_, cookbookId) => {
      // Invalidate both list and detail queries
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: cookbookKeys.list(user.id, language),
        });
      }
      queryClient.invalidateQueries({
        queryKey: cookbookKeys.detail(cookbookId, language),
      });
    },
  });
}

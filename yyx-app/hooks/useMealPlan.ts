/**
 * useMealPlan
 *
 * TanStack Query wrapper around the meal planner service. Exposes the active
 * plan and an `addRecipeToSlot` mutation used by the Explore "Add to Plan"
 * modal.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { mealPlanService } from '@/services/mealPlanService';
import type { AddRecipeToSlotPayload, MealPlan } from '@/types/mealPlan';

export const mealPlanKeys = {
  all: ['mealPlan'] as const,
  current: (userId?: string | null) => [...mealPlanKeys.all, 'current', userId] as const,
};

export function useMealPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<MealPlan | null>({
    queryKey: mealPlanKeys.current(user?.id ?? null),
    queryFn: () => mealPlanService.getCurrentPlan(),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const addRecipeToSlot = useMutation({
    mutationFn: (payload: AddRecipeToSlotPayload) =>
      mealPlanService.addRecipeToSlot(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealPlanKeys.current(user?.id ?? null) });
    },
  });

  return {
    plan: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
    addRecipeToSlot,
  };
}

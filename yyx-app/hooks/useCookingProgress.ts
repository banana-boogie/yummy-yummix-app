/**
 * Cooking Progress Hook
 *
 * Manages cooking session persistence so users can resume mid-cook.
 * Upserts progress on step changes, marks sessions complete/abandoned.
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface CookingSession {
  id: string;
  recipeId: string;
  recipeType: 'custom' | 'database';
  recipeName: string;
  currentStep: number;
  totalSteps: number;
  status: 'active' | 'completed' | 'abandoned';
}

/**
 * Hook for managing cooking session progress.
 */
export function useCookingProgress() {
  const { user } = useAuth();

  /**
   * Upsert cooking progress when the user navigates to a new step.
   */
  const upsertProgress = useCallback(async (params: {
    recipeId: string;
    recipeType: 'custom' | 'database';
    recipeName: string;
    currentStep: number;
    totalSteps: number;
  }) => {
    if (!user) return;

    const { error } = await supabase.rpc('upsert_cooking_session_progress', {
      p_recipe_id: params.recipeId,
      p_recipe_type: params.recipeType,
      p_recipe_name: params.recipeName,
      p_current_step: params.currentStep,
      p_total_steps: params.totalSteps,
    });

    if (error) {
      if (__DEV__) console.error('[useCookingProgress] upsert error:', error.message);
    }
  }, [user]);

  /**
   * Mark a cooking session as completed.
   */
  const completeSession = useCallback(async (recipeId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('cooking_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('recipe_id', recipeId)
      .eq('status', 'active');

    if (error) {
      if (__DEV__) console.error('[useCookingProgress] complete error:', error.message);
    }
  }, [user]);

  /**
   * Mark a cooking session as abandoned (user chose to start over or cancel).
   */
  const abandonSession = useCallback(async (recipeId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('cooking_sessions')
      .update({
        status: 'abandoned',
        abandoned_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('recipe_id', recipeId)
      .eq('status', 'active');

    if (error) {
      if (__DEV__) console.error('[useCookingProgress] abandon error:', error.message);
    }
  }, [user]);

  /**
   * Get the most recent resumable cooking session for the current user.
   * Returns null if no active session exists.
   */
  const getResumableSession = useCallback(async (): Promise<CookingSession | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('cooking_sessions')
      .select('id, recipe_id, recipe_type, recipe_name, current_step, total_steps, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_active_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (__DEV__) console.error('[useCookingProgress] getResumable error:', error.message);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      recipeId: data.recipe_id,
      recipeType: data.recipe_type,
      recipeName: data.recipe_name,
      currentStep: data.current_step,
      totalSteps: data.total_steps,
      status: data.status,
    };
  }, [user]);

  return {
    upsertProgress,
    completeSession,
    abandonSession,
    getResumableSession,
  };
}

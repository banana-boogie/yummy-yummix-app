/**
 * useActivePlan
 *
 * Minimal hook for chat's Home Actions: reports whether the user has an
 * active meal plan. Calls the meal-planner edge function's `get_current_plan`
 * action.
 *
 * WARNING — active-plan detection is unreliable.
 * The `get_current_plan` action in the meal-planner edge function is a stub
 * today (PR #1) that always returns `{ plan: null }`, so this hook currently
 * reports `hasActivePlan: false` for every user. IrmixyHomeActions therefore
 * no longer branches on the return value and only shows the no-plan card
 * set. Re-enable branching once `get_current_plan` returns real plan data.
 *
 * Kept colocated with chat (hooks/chat/) intentionally: this PR does not
 * introduce a full planner client layer.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface GetCurrentPlanEnvelope {
    plan: unknown;
    warnings?: string[];
}

export interface ActivePlanState {
    hasActivePlan: boolean;
    isLoading: boolean;
}

export function useActivePlan(): ActivePlanState {
    const { user } = useAuth();

    const { data, isLoading } = useQuery({
        queryKey: ['meal-planner', 'get_current_plan', user?.id ?? 'anon'],
        enabled: !!user,
        staleTime: 60_000,
        // A stub response counts as "no active plan" — we only flip true when
        // the edge function returns a real plan object.
        queryFn: async (): Promise<boolean> => {
            try {
                const { data: raw, error } = await supabase.functions.invoke<GetCurrentPlanEnvelope>(
                    'meal-planner',
                    { body: { action: 'get_current_plan', payload: {} } },
                );
                if (error || !raw) return false;
                return !!raw.plan && typeof raw.plan === 'object';
            } catch {
                return false;
            }
        },
    });

    return {
        hasActivePlan: !!data,
        isLoading,
    };
}

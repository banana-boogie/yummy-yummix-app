/**
 * useActivePlan
 *
 * Minimal hook for chat's Home Actions: reports whether the user has an
 * active meal plan. Calls the meal-planner edge function's `get_current_plan`
 * action. The backend is a stub today ({ plan: null, warnings: [...] }) —
 * this hook treats any non-null `plan` shape as "active" and every error or
 * stub response as "no active plan" so chat degrades gracefully.
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

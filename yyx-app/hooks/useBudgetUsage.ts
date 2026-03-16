import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBudgetUsage, BudgetUsage } from '@/services/budgetService';
import logger from '@/services/logger';

interface UseBudgetUsageResult {
  usage: BudgetUsage | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch the current user's AI budget usage for display in settings.
 * Fetches on mount and exposes a refetch function.
 */
export function useBudgetUsage(): UseBudgetUsageResult {
  const { user } = useAuth();
  const [usage, setUsage] = useState<BudgetUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchBudgetUsage(user!.id);
        if (!cancelled) {
          setUsage(data);
        }
      } catch (err) {
        logger.error('[useBudgetUsage] Error:', err);
        if (!cancelled) {
          setError('Failed to load usage');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user?.id, refetchKey]);

  const refetch = () => setRefetchKey((k) => k + 1);

  return { usage, loading, error, refetch };
}

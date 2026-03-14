import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  adminContentHealthService,
  ContentHealthData,
  ContentHealthIssue,
  IssueFilter,
  EntityFilter,
} from '@/services/admin/adminContentHealthService';

export function useContentHealth() {
  const [data, setData] = useState<ContentHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [activeFilter, setActiveFilter] = useState<IssueFilter>('all');
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [retryKey, setRetryKey] = useState(0);

  const refresh = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await adminContentHealthService.getContentHealth();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : (err as { message?: string })?.message || JSON.stringify(err);
          setError(new Error(message));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const filteredIssues = useMemo(() => {
    if (!data) return [];

    let issues: ContentHealthIssue[] = data.issues;

    // Filter by entity type
    if (entityFilter !== 'all') {
      issues = issues.filter((issue) => issue.entityType === entityFilter);
    }

    // Filter by issue type
    if (activeFilter !== 'all') {
      issues = issues.filter((issue) => {
        switch (activeFilter) {
          case 'translation':
            return issue.missingEn || issue.missingEs;
          case 'image':
            return issue.missingImage;
          case 'nutrition':
            return issue.missingNutrition;
          case 'unpublished':
            return issue.isPublished === false;
          default:
            return true;
        }
      });
    }

    return issues;
  }, [data, activeFilter, entityFilter]);

  const filteredCount = filteredIssues.length;

  return {
    data,
    loading,
    error,
    refresh,
    activeFilter,
    setActiveFilter,
    entityFilter,
    setEntityFilter,
    filteredIssues,
    filteredCount,
  };
}

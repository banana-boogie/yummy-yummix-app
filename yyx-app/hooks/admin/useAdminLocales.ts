import { useMemo } from 'react';
import { useActiveLocales, ActiveLocale } from '@/hooks/admin/useActiveLocales';

/**
 * Admin-specific locale hook. Wraps useActiveLocales(true) and filters out
 * es-MX (redundant with base 'es' which is already Mexican Spanish).
 * Use this in admin forms and display toggles instead of useActiveLocales directly.
 */
export function useAdminLocales() {
  const { locales: rawLocales, loading } = useActiveLocales(true);

  const locales = useMemo(
    () => rawLocales.filter(l => l.code !== 'es-MX'),
    [rawLocales],
  );

  return { locales, loading };
}

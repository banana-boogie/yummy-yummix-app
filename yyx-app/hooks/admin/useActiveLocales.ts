import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface ActiveLocale {
  code: string;
  displayName: string;
}

/**
 * Fetches active locales from the locales table, ordered with 'es' first (Mexico-first audience).
 * @param includeRegional - If true, includes regional variants (es-MX, es-ES). Default: false (base locales only).
 */
export function useActiveLocales(includeRegional = false) {
  const [locales, setLocales] = useState<ActiveLocale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLocales() {
      try {
        let query = supabase
          .from('locales')
          .select('code, display_name')
          .eq('is_active', true)
          .order('code', { ascending: true });

        if (!includeRegional) {
          query = query.not('code', 'like', '%-%');
        } else {
          // Exclude es-MX: base 'es' is already Mexican Spanish, so es-MX is redundant.
          // Other regional variants (es-ES) remain since they represent genuine differences.
          query = query.neq('code', 'es-MX');
        }

        const { data, error } = await query;

        if (error) {
          console.error('Failed to fetch locales:', error);
          // Fallback to hardcoded es/en
          if (!cancelled) {
            setLocales([
              { code: 'es', displayName: 'Español' },
              { code: 'en', displayName: 'English' },
            ]);
          }
          return;
        }

        if (!cancelled && data) {
          const mapped = data.map((l: any) => ({
            code: l.code,
            displayName: l.display_name,
          }));

          // Sort: es first, then alphabetical
          mapped.sort((a, b) => {
            if (a.code === 'es') return -1;
            if (b.code === 'es') return 1;
            return a.code.localeCompare(b.code);
          });

          setLocales(mapped);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLocales();
    return () => { cancelled = true; };
  }, [includeRegional]);

  return { locales, loading };
}

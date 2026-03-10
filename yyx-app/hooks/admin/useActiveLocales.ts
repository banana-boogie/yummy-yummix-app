import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface ActiveLocale {
  code: string;
  displayName: string;
}

/**
 * Fetches active base locales (e.g. 'es', 'en' — not regional variants like 'es-MX')
 * from the locales table, ordered with 'es' first (Mexico-first audience).
 */
export function useActiveLocales() {
  const [locales, setLocales] = useState<ActiveLocale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLocales() {
      try {
        const { data, error } = await supabase
          .from('locales')
          .select('code, display_name')
          .not('code', 'like', '%-%')
          .eq('is_active', true)
          .order('code', { ascending: true });

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
  }, []);

  return { locales, loading };
}

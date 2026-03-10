import { supabase } from '@/lib/supabase';

interface TranslateRequest {
  fields: Record<string, string>;
  sourceLocale: string;
  targetLocales: string[];
}

interface TranslateResult {
  targetLocale: string;
  fields: Record<string, string>;
}

export async function translateContent(
  fields: Record<string, string>,
  sourceLocale: string,
  targetLocales: string[],
): Promise<TranslateResult[]> {
  const { data, error } = await supabase.functions.invoke('translate-content', {
    body: { fields, sourceLocale, targetLocales },
  });
  if (error) throw new Error(`Translation failed: ${error.message}`);
  return data.translations;
}

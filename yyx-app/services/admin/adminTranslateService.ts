import { supabase } from '@/lib/supabase';

export interface TranslationResult {
  targetLocale: string;
  fields: Record<string, string>;
  error?: string;
}

export async function translateContent(
  fields: Record<string, string>,
  sourceLocale: string,
  targetLocales: string[],
): Promise<TranslationResult[]> {
  const { data, error } = await supabase.functions.invoke('translate-content', {
    body: { fields, sourceLocale, targetLocales },
  });
  if (error) throw new Error(`Translation failed: ${error.message}`);
  return data.translations;
}

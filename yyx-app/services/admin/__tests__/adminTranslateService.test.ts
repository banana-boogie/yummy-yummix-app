/**
 * AdminTranslateService Tests
 *
 * Tests for the translateContent function that wraps
 * the translate-content Supabase Edge Function.
 */

import { translateContent } from '../adminTranslateService';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
}));

describe('translateContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // SUCCESS CASES
  // ============================================================

  it('calls supabase.functions.invoke with correct function name and body', async () => {
    const fields = { name: 'Mixing Bowl' };
    const sourceLocale = 'en';
    const targetLocales = ['es'];

    mockInvoke.mockResolvedValue({
      data: { translations: [{ targetLocale: 'es', fields: { name: 'Tazón para mezclar' } }] },
      error: null,
    });

    await translateContent(fields, sourceLocale, targetLocales);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('translate-content', {
      body: { fields, sourceLocale, targetLocales },
    });
  });

  it('returns data.translations on success', async () => {
    const expectedTranslations = [
      { targetLocale: 'es', fields: { name: 'Tazón para mezclar' } },
    ];

    mockInvoke.mockResolvedValue({
      data: { translations: expectedTranslations },
      error: null,
    });

    const result = await translateContent(
      { name: 'Mixing Bowl' },
      'en',
      ['es'],
    );

    expect(result).toEqual(expectedTranslations);
  });

  it('handles multiple target locales', async () => {
    const expectedTranslations = [
      { targetLocale: 'es', fields: { name: 'Tazón para mezclar' } },
      { targetLocale: 'fr', fields: { name: 'Bol à mélanger' } },
      { targetLocale: 'de', fields: { name: 'Rührschüssel' } },
    ];

    mockInvoke.mockResolvedValue({
      data: { translations: expectedTranslations },
      error: null,
    });

    const result = await translateContent(
      { name: 'Mixing Bowl' },
      'en',
      ['es', 'fr', 'de'],
    );

    expect(result).toEqual(expectedTranslations);
    expect(result).toHaveLength(3);
    expect(mockInvoke).toHaveBeenCalledWith('translate-content', {
      body: {
        fields: { name: 'Mixing Bowl' },
        sourceLocale: 'en',
        targetLocales: ['es', 'fr', 'de'],
      },
    });
  });

  it('handles single field translation', async () => {
    const fields = { title: 'Chocolate Cake' };
    const expectedTranslations = [
      { targetLocale: 'es', fields: { title: 'Pastel de Chocolate' } },
    ];

    mockInvoke.mockResolvedValue({
      data: { translations: expectedTranslations },
      error: null,
    });

    const result = await translateContent(fields, 'en', ['es']);

    expect(result).toEqual(expectedTranslations);
  });

  it('handles multiple fields translation', async () => {
    const fields = {
      title: 'Chocolate Cake',
      description: 'A rich and moist chocolate cake',
      instructions: 'Mix all ingredients together',
    };
    const expectedTranslations = [
      {
        targetLocale: 'es',
        fields: {
          title: 'Pastel de Chocolate',
          description: 'Un pastel de chocolate rico y húmedo',
          instructions: 'Mezcla todos los ingredientes',
        },
      },
    ];

    mockInvoke.mockResolvedValue({
      data: { translations: expectedTranslations },
      error: null,
    });

    const result = await translateContent(fields, 'en', ['es']);

    expect(result).toEqual(expectedTranslations);
    expect(mockInvoke).toHaveBeenCalledWith('translate-content', {
      body: { fields, sourceLocale: 'en', targetLocales: ['es'] },
    });
  });

  // ============================================================
  // ERROR CASES
  // ============================================================

  it('throws Error with message when edge function returns an error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge function timeout' },
    });

    await expect(
      translateContent({ name: 'Bowl' }, 'en', ['es']),
    ).rejects.toThrow('Translation failed: Edge function timeout');
  });
});

import i18n from '@/i18n';
import { cookbookService } from '../cookbookService';
import {
  getMockSupabaseClient,
  mockDatabaseQuery,
  resetSupabaseMocks,
} from '@/test/mocks/supabase';

describe('cookbookService', () => {
  const originalLocale = i18n.locale;
  const originalCrypto = global.crypto;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSupabaseMocks();
    i18n.locale = 'en';
  });

  afterAll(() => {
    i18n.locale = originalLocale;
    global.crypto = originalCrypto;
  });

  it('uses single-language names for custom cookbooks and localized names for Favorites', async () => {
    i18n.locale = 'es';

    const rows = [
      {
        id: 'cb-default',
        user_id: 'user-1',
        name_en: 'Favorites',
        name_es: 'Favoritos',
        description_en: 'My favorite recipes',
        description_es: 'Mis recetas favoritas',
        is_public: false,
        is_default: true,
        share_token: 'token-default',
        share_enabled: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        cookbook_recipes: [{ count: 0 }],
      },
      {
        id: 'cb-custom',
        user_id: 'user-1',
        name_en: 'Family Meals',
        name_es: 'Comidas Familiares',
        description_en: 'Weekly dinners',
        description_es: 'Cenas semanales',
        is_public: false,
        is_default: false,
        share_token: 'token-custom',
        share_enabled: false,
        created_at: '2026-01-02T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        cookbook_recipes: [{ count: 2 }],
      },
    ];

    mockDatabaseQuery('cookbooks', rows);

    const result = await cookbookService.getUserCookbooks('user-1');

    const defaultCookbook = result.find((item) => item.id === 'cb-default');
    const customCookbook = result.find((item) => item.id === 'cb-custom');

    expect(defaultCookbook?.name).toBe('Favoritos');
    expect(defaultCookbook?.description).toBe('Mis recetas favoritas');
    expect(customCookbook?.name).toBe('Family Meals');
    expect(customCookbook?.description).toBe('Weekly dinners');
  });

  it('prefers notes_en even when locale is es', async () => {
    i18n.locale = 'es';

    const cookbook = {
      id: 'cb-1',
      user_id: 'user-1',
      name_en: 'Family',
      name_es: 'Familia',
      description_en: null,
      description_es: null,
      is_public: false,
      is_default: false,
      share_token: 'token-1',
      share_enabled: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      cookbook_recipes: [
        {
          id: 'cr-1',
          cookbook_id: 'cb-1',
          recipe_id: 'recipe-1',
          notes_en: 'Use less salt',
          notes_es: 'Usa menos sal',
          display_order: 0,
          added_at: '2026-01-01T00:00:00Z',
          recipes: {
            id: 'recipe-1',
            name_en: 'Pasta',
            name_es: 'Pasta',
            description_en: null,
            description_es: null,
            image_url: null,
            prep_time_minutes: 10,
            cook_time_minutes: 15,
            servings: 2,
            difficulty: 'easy',
          },
        },
      ],
    };

    mockDatabaseQuery('cookbooks', cookbook, { single: true });

    const result = await cookbookService.getCookbookById('cb-1');

    expect(result.recipes[0].notes).toBe('Use less salt');
  });

  it('trims share token before RPC calls', async () => {
    const mockClient = getMockSupabaseClient();

    mockClient.rpc
      .mockResolvedValueOnce({
        data: [
          {
            id: 'cb-1',
            user_id: 'user-1',
            name_en: 'Shared',
            name_es: null,
            description_en: null,
            description_es: null,
            is_public: false,
            is_default: false,
            share_token: 'token-1',
            share_enabled: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    await cookbookService.getCookbookByShareToken('  token-1  ');

    expect(mockClient.rpc).toHaveBeenCalledWith('get_cookbook_by_share_token', {
      p_share_token: 'token-1',
    });
  });

  it('falls back to client UUID generation when RPC fails', async () => {
    const mockClient = getMockSupabaseClient();

    mockClient.rpc.mockResolvedValue({ data: null, error: { message: 'RPC missing' } });

    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockResolvedValue({ error: null });
    mockClient.from.mockReturnValue({ update, eq });

    global.crypto = {
      randomUUID: jest.fn().mockReturnValue('uuid-123'),
    } as Crypto;

    const token = await cookbookService.regenerateShareToken('cb-1');

    expect(token).toBe('uuid-123');
    expect(update).toHaveBeenCalledWith({
      share_token: 'uuid-123',
      share_enabled: true,
    });
  });
});

import i18n from '@/i18n';
import { cookbookService } from '../cookbookService';
import {
  getMockSupabaseClient,
  mockDatabaseQuery,
  resetSupabaseMocks,
} from '@/test/mocks/supabase';

// ============================================================================
// Factory helpers for translation-based test data
// ============================================================================

function createCookbookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cb-1',
    user_id: 'user-1',
    is_public: false,
    is_default: false,
    share_token: 'token-1',
    share_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    translations: [
      { locale: 'en', name: 'Family', description: 'Family favorites' },
    ],
    cookbook_recipes: [{ count: 0 }],
    ...overrides,
  };
}

function createCookbookWithRecipesRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cb-1',
    user_id: 'user-1',
    is_public: false,
    is_default: false,
    share_token: 'token-1',
    share_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    translations: [
      { locale: 'en', name: 'Family', description: null },
    ],
    cookbook_recipes: [
      {
        id: 'cr-1',
        cookbook_id: 'cb-1',
        recipe_id: 'recipe-1',
        translations: [
          { locale: 'en', notes: 'Use less salt' },
          { locale: 'es', notes: 'Usa menos sal' },
        ],
        display_order: 0,
        added_at: '2026-01-01T00:00:00Z',
        recipes: {
          id: 'recipe-1',
          image_url: null,
          prep_time_minutes: 10,
          cook_time_minutes: 15,
          servings: 2,
          difficulty: 'easy',
          translations: [
            { locale: 'en', name: 'Pasta' },
            { locale: 'es', name: 'Pasta' },
          ],
        },
      },
    ],
    ...overrides,
  };
}

describe('cookbookService', () => {
  const originalLocale = i18n.locale;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSupabaseMocks();
    i18n.locale = 'en';
  });

  afterAll(() => {
    i18n.locale = originalLocale;
  });

  // ==========================================================================
  // getUserCookbooks
  // ==========================================================================

  it('resolves localized names via translations array', async () => {
    i18n.locale = 'es';

    const rows = [
      createCookbookRow({
        id: 'cb-default',
        is_default: true,
        share_token: 'token-default',
        translations: [
          { locale: 'en', name: 'Favorites', description: 'My favorite recipes' },
          { locale: 'es', name: 'Favoritos', description: 'Mis recetas favoritas' },
        ],
        cookbook_recipes: [{ count: 0 }],
      }),
      createCookbookRow({
        id: 'cb-custom',
        share_token: 'token-custom',
        translations: [
          { locale: 'en', name: 'Family Meals', description: 'Weekly dinners' },
        ],
        cookbook_recipes: [{ count: 2 }],
      }),
    ];

    mockDatabaseQuery('cookbooks', rows);

    const result = await cookbookService.getUserCookbooks('user-1');

    const defaultCookbook = result.find((item) => item.id === 'cb-default');
    const customCookbook = result.find((item) => item.id === 'cb-custom');

    expect(defaultCookbook?.name).toBe('Favoritos');
    expect(defaultCookbook?.description).toBe('Mis recetas favoritas');
    // Custom cookbook only has 'en' translation, falls back to 'en'
    expect(customCookbook?.name).toBe('Family Meals');
    expect(customCookbook?.recipeCount).toBe(2);
  });

  // ==========================================================================
  // getCookbookById
  // ==========================================================================

  it('resolves recipe notes via translations array', async () => {
    i18n.locale = 'en';

    const cookbook = createCookbookWithRecipesRow();
    mockDatabaseQuery('cookbooks', cookbook, { single: true });

    const result = await cookbookService.getCookbookById('cb-1');

    expect(result.recipes[0].notes).toBe('Use less salt');
    expect(result.recipes[0].name).toBe('Pasta');
  });

  // ==========================================================================
  // getCookbookByShareToken
  // ==========================================================================

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

  it('throws when share token is empty', async () => {
    await expect(cookbookService.getCookbookByShareToken('')).rejects.toThrow(
      'Share token is required'
    );
  });

  // ==========================================================================
  // regenerateShareToken
  // ==========================================================================

  it('throws when RPC fails for regenerateShareToken', async () => {
    const mockClient = getMockSupabaseClient();
    mockClient.rpc.mockResolvedValue({ data: null, error: { message: 'RPC missing' } });

    await expect(cookbookService.regenerateShareToken('cb-1')).rejects.toThrow('RPC missing');
  });

  it('returns new token on successful regeneration', async () => {
    const mockClient = getMockSupabaseClient();
    mockClient.rpc.mockResolvedValue({ data: 'new-token-abc', error: null });

    const token = await cookbookService.regenerateShareToken('cb-1');

    expect(token).toBe('new-token-abc');
    expect(mockClient.rpc).toHaveBeenCalledWith('regenerate_cookbook_share_token', {
      cookbook_id: 'cb-1',
    });
  });

  // ==========================================================================
  // createCookbook
  // ==========================================================================

  it('creates cookbook entity and upserts translation row', async () => {
    const mockClient = getMockSupabaseClient();

    const insertedCookbook = {
      id: 'cb-new',
      user_id: 'user-1',
      is_public: false,
      is_default: false,
      share_token: 'gen-token',
      share_enabled: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    // Mock cookbooks table insert chain
    const cookbooksChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: insertedCookbook, error: null }),
    };

    // Mock cookbook_translations table upsert chain
    const translationsChain = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbooks') return cookbooksChain;
      if (table === 'cookbook_translations') return translationsChain;
      return { select: jest.fn().mockReturnThis(), then: jest.fn() };
    });

    const result = await cookbookService.createCookbook('user-1', {
      name: 'Italian',
      description: 'Italian dishes',
      isPublic: true,
    });

    // Verify cookbooks insert
    expect(cookbooksChain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      is_public: true,
      is_default: false,
    });

    // Verify translation upsert
    expect(translationsChain.upsert).toHaveBeenCalledWith(
      {
        cookbook_id: 'cb-new',
        locale: 'en',
        name: 'Italian',
        description: 'Italian dishes',
      },
      { onConflict: 'cookbook_id,locale' }
    );

    // Verify returned transformed cookbook
    expect(result.id).toBe('cb-new');
    expect(result.name).toBe('Italian');
    expect(result.description).toBe('Italian dishes');
    expect(result.recipeCount).toBe(0);
  });

  it('throws when cookbook creation fails', async () => {
    const mockClient = getMockSupabaseClient();

    const cookbooksChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbooks') return cookbooksChain;
      return { upsert: jest.fn().mockResolvedValue({ error: null }) };
    });

    await expect(
      cookbookService.createCookbook('user-1', { name: 'Test' })
    ).rejects.toThrow('Insert failed');
  });

  // ==========================================================================
  // updateCookbook
  // ==========================================================================

  it('updates entity fields and upserts translation', async () => {
    const mockClient = getMockSupabaseClient();

    const cookbooksChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };

    const translationsChain = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbooks') return cookbooksChain;
      if (table === 'cookbook_translations') return translationsChain;
      return {};
    });

    await cookbookService.updateCookbook('cb-1', {
      name: 'Updated Name',
      isPublic: true,
    });

    // Verify entity update for non-translatable field
    expect(cookbooksChain.update).toHaveBeenCalledWith({ is_public: true });

    // Verify translation upsert
    expect(translationsChain.upsert).toHaveBeenCalledWith(
      {
        cookbook_id: 'cb-1',
        locale: 'en',
        name: 'Updated Name',
      },
      { onConflict: 'cookbook_id,locale' }
    );
  });

  it('skips entity update when only translation fields change', async () => {
    const mockClient = getMockSupabaseClient();

    const cookbooksChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };

    const translationsChain = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbooks') return cookbooksChain;
      if (table === 'cookbook_translations') return translationsChain;
      return {};
    });

    await cookbookService.updateCookbook('cb-1', { name: 'New Name' });

    // Entity update should NOT be called (no non-translatable fields)
    expect(cookbooksChain.update).not.toHaveBeenCalled();
    // Translation upsert should be called
    expect(translationsChain.upsert).toHaveBeenCalled();
  });

  // ==========================================================================
  // deleteCookbook
  // ==========================================================================

  it('deletes a cookbook successfully', async () => {
    const mockClient = getMockSupabaseClient();

    const chain = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbooks') return chain;
      return {};
    });

    await cookbookService.deleteCookbook('cb-1');

    expect(mockClient.from).toHaveBeenCalledWith('cookbooks');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'cb-1');
  });

  it('throws when deletion fails', async () => {
    const mockClient = getMockSupabaseClient();

    const chain = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: { message: 'Forbidden' } }),
    };

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbooks') return chain;
      return {};
    });

    await expect(cookbookService.deleteCookbook('cb-1')).rejects.toThrow('Forbidden');
  });

  // ==========================================================================
  // addRecipeToCookbook
  // ==========================================================================

  it('adds recipe with correct display_order and upserts notes translation', async () => {
    const mockClient = getMockSupabaseClient();

    // Mock getting current max display order
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ display_order: 2 }] }),
    };

    // Mock inserting the junction row
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'cr-new' },
        error: null,
      }),
    };

    // Mock translation upsert
    const translationChain = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbook_recipes') {
        callCount++;
        // First call = select for display_order, second call = insert
        return callCount === 1 ? selectChain : insertChain;
      }
      if (table === 'cookbook_recipe_translations') return translationChain;
      return {};
    });

    await cookbookService.addRecipeToCookbook({
      cookbookId: 'cb-1',
      recipeId: 'recipe-1',
      notes: 'Extra garlic',
    });

    // Should insert with display_order = 3 (max existing is 2)
    expect(insertChain.insert).toHaveBeenCalledWith({
      cookbook_id: 'cb-1',
      recipe_id: 'recipe-1',
      display_order: 3,
    });

    // Should upsert notes translation
    expect(translationChain.upsert).toHaveBeenCalledWith(
      {
        cookbook_recipe_id: 'cr-new',
        locale: 'en',
        notes: 'Extra garlic',
      },
      { onConflict: 'cookbook_recipe_id,locale' }
    );
  });

  it('uses display_order 0 when cookbook has no recipes', async () => {
    const mockClient = getMockSupabaseClient();

    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [] }),
    };

    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'cr-new' },
        error: null,
      }),
    };

    let callCount = 0;
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbook_recipes') {
        callCount++;
        return callCount === 1 ? selectChain : insertChain;
      }
      return {};
    });

    await cookbookService.addRecipeToCookbook({
      cookbookId: 'cb-1',
      recipeId: 'recipe-1',
    });

    expect(insertChain.insert).toHaveBeenCalledWith({
      cookbook_id: 'cb-1',
      recipe_id: 'recipe-1',
      display_order: 0,
    });
  });

  it('throws RECIPE_ALREADY_ADDED on unique constraint violation', async () => {
    const mockClient = getMockSupabaseClient();

    const selectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [] }),
    };

    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      }),
    };

    let callCount = 0;
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbook_recipes') {
        callCount++;
        return callCount === 1 ? selectChain : insertChain;
      }
      return {};
    });

    await expect(
      cookbookService.addRecipeToCookbook({
        cookbookId: 'cb-1',
        recipeId: 'recipe-1',
      })
    ).rejects.toThrow('RECIPE_ALREADY_ADDED');
  });

  // ==========================================================================
  // removeRecipeFromCookbook
  // ==========================================================================

  it('removes a recipe from a cookbook successfully', async () => {
    const mockClient = getMockSupabaseClient();

    const chain = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    // The last eq call in the chain resolves the promise
    chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce({ error: null });

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbook_recipes') return chain;
      return {};
    });

    await cookbookService.removeRecipeFromCookbook('cb-1', 'recipe-1');

    expect(mockClient.from).toHaveBeenCalledWith('cookbook_recipes');
    expect(chain.delete).toHaveBeenCalled();
  });

  it('throws when removal fails', async () => {
    const mockClient = getMockSupabaseClient();

    const chain = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce({
      error: { message: 'Not found' },
    });

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbook_recipes') return chain;
      return {};
    });

    await expect(
      cookbookService.removeRecipeFromCookbook('cb-1', 'recipe-1')
    ).rejects.toThrow('Not found');
  });

  // ==========================================================================
  // ensureDefaultCookbook
  // ==========================================================================

  it('returns existing default cookbook if one exists', async () => {
    const existingDefault = createCookbookRow({
      id: 'cb-default',
      is_default: true,
      translations: [
        { locale: 'en', name: 'Favorites', description: 'My favorite recipes' },
      ],
    });

    mockDatabaseQuery('cookbooks', existingDefault, { single: true });

    const result = await cookbookService.ensureDefaultCookbook('user-1');

    expect(result.id).toBe('cb-default');
    expect(result.name).toBe('Favorites');
    expect(result.isDefault).toBe(true);
  });

  it('creates Favorites cookbook with both locale translations when none exists', async () => {
    const mockClient = getMockSupabaseClient();

    // First call: check if default exists -- returns PGRST116 (not found)
    const checkChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      }),
    };

    // Second call: insert the new cookbook
    const insertedCookbook = {
      id: 'cb-new-default',
      user_id: 'user-1',
      is_public: false,
      is_default: true,
      share_token: 'gen-token',
      share_enabled: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: insertedCookbook, error: null }),
    };

    // Third call: upsert translations
    const translationsChain = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    let cookbooksCallCount = 0;
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'cookbooks') {
        cookbooksCallCount++;
        return cookbooksCallCount === 1 ? checkChain : insertChain;
      }
      if (table === 'cookbook_translations') return translationsChain;
      return {};
    });

    const result = await cookbookService.ensureDefaultCookbook('user-1');

    // Should insert with is_default: true
    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      is_public: false,
      is_default: true,
    });

    // Should upsert both en and es translations
    expect(translationsChain.upsert).toHaveBeenCalledWith(
      [
        { cookbook_id: 'cb-new-default', locale: 'en', name: 'Favorites', description: 'My favorite recipes' },
        { cookbook_id: 'cb-new-default', locale: 'es', name: 'Favoritos', description: 'Mis recetas favoritas' },
      ],
      { onConflict: 'cookbook_id,locale' }
    );

    expect(result.id).toBe('cb-new-default');
    expect(result.isDefault).toBe(true);
    expect(result.name).toBe('Favorites');
  });
});

/**
 * customRecipeService Tests
 *
 * Tests for saving, loading, listing, and deleting custom recipes.
 * Tests both schema 2.0 (normalized tables) and schema 1.0 (JSONB fallback).
 */

import { customRecipeService } from '../customRecipeService';
import { createMockGeneratedRecipe } from '@/test/mocks/chat';
import {
    getMockSupabaseClient,
    mockSupabaseAuthSuccess,
    mockSupabaseAuthError,
} from '@/test/mocks/supabase';

describe('customRecipeService', () => {
    const mockClient = getMockSupabaseClient();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Helper to create a fully chainable mock
    const createChainableMock = (finalResult: { data: any; error: any }) => {
        const chain: any = {};
        const methods = [
            'insert',
            'select',
            'delete',
            'update',
            'eq',
            'order',
            'limit',
            'single',
        ];
        methods.forEach((method) => {
            chain[method] = jest.fn().mockReturnValue(chain);
        });
        chain.single = jest.fn().mockResolvedValue(finalResult);
        // Make chain thenable for .then() calls
        chain.then = (resolve: Function) => Promise.resolve(finalResult).then(resolve);
        return chain;
    };

    // ============================================================
    // save() Tests
    // ============================================================

    describe('save', () => {
        it('saves recipe with schema 2.0 and calls all table inserts', async () => {
            const mockUser = mockSupabaseAuthSuccess().user;
            const recipe = createMockGeneratedRecipe();

            // Track which tables are called
            const tableCalls: string[] = [];

            mockClient.from.mockImplementation((table: string) => {
                tableCalls.push(table);

                const chain: any = {};
                ['insert', 'select', 'delete', 'eq', 'order', 'single'].forEach((m) => {
                    chain[m] = jest.fn().mockReturnValue(chain);
                });

                if (table === 'user_recipes') {
                    chain.single = jest.fn().mockResolvedValue({
                        data: { id: 'recipe-456' },
                        error: null,
                    });
                } else if (table === 'user_recipe_ingredients') {
                    chain.then = (resolve: Function) =>
                        resolve({
                            data: recipe.ingredients.map((ing, i) => ({
                                id: `ing-${i}`,
                                name_en: ing.name,
                            })),
                            error: null,
                        });
                } else if (table === 'user_recipe_steps') {
                    chain.then = (resolve: Function) =>
                        resolve({
                            data: recipe.steps.map((s) => ({
                                id: `step-${s.order}`,
                                step_order: s.order,
                            })),
                            error: null,
                        });
                } else {
                    chain.then = (resolve: Function) => resolve({ error: null });
                }

                return chain;
            });

            const result = await customRecipeService.save(recipe, 'My Recipe');

            expect(result.userRecipeId).toBe('recipe-456');
            expect(tableCalls).toContain('user_recipes');
            expect(tableCalls).toContain('user_recipe_ingredients');
            expect(tableCalls).toContain('user_recipe_steps');
        });

        it('throws on auth error', async () => {
            mockSupabaseAuthError('Not authenticated');
            const recipe = createMockGeneratedRecipe();

            await expect(customRecipeService.save(recipe, 'My Recipe')).rejects.toThrow(
                'User not authenticated'
            );
        });

        it('throws on recipe insert error', async () => {
            mockSupabaseAuthSuccess();
            const recipe = createMockGeneratedRecipe();

            const chain = createChainableMock({
                data: null,
                error: { message: 'Database error' },
            });
            mockClient.from.mockReturnValue(chain);

            await expect(customRecipeService.save(recipe, 'My Recipe')).rejects.toThrow(
                'Failed to save recipe'
            );
        });
    });

    // ============================================================
    // load() Tests
    // ============================================================

    describe('load', () => {
        it('loads schema 1.0 recipe from JSONB (fallback)', async () => {
            mockSupabaseAuthSuccess();
            const recipe = createMockGeneratedRecipe();

            const chain = createChainableMock({
                data: {
                    id: 'recipe-123',
                    name: 'My Recipe',
                    recipe_data: recipe,
                    source: 'ai_generated',
                    created_at: '2024-01-15T12:00:00Z',
                    schema_version: '1.0',
                },
                error: null,
            });
            mockClient.from.mockReturnValue(chain);

            const result = await customRecipeService.load('recipe-123');

            expect(result.id).toBe('recipe-123');
            expect(result.name).toBe('My Recipe');
            expect(result.recipe).toEqual(recipe);
            expect(result.source).toBe('ai_generated');
        });

        it('loads schema 2.0 recipe from normalized tables', async () => {
            mockSupabaseAuthSuccess();

            // First call is user_recipes, subsequent calls are for normalized tables
            let callCount = 0;
            mockClient.from.mockImplementation((table: string) => {
                const chain: any = {};
                ['insert', 'select', 'delete', 'eq', 'order', 'single'].forEach((m) => {
                    chain[m] = jest.fn().mockReturnValue(chain);
                });

                if (table === 'user_recipes') {
                    chain.single = jest.fn().mockResolvedValue({
                        data: {
                            id: 'recipe-123',
                            name: 'My Recipe',
                            source: 'ai_generated',
                            created_at: '2024-01-15T12:00:00Z',
                            schema_version: '2.0',
                            total_time: 30,
                            difficulty: 'easy',
                            portions: 4,
                            measurement_system: 'metric',
                            language: 'en',
                            recipe_data: null,
                        },
                        error: null,
                    });
                } else if (table === 'user_recipe_steps') {
                    chain.then = (resolve: Function) =>
                        resolve({
                            data: [
                                {
                                    id: 'step-1',
                                    step_order: 1,
                                    instruction_en: 'Chop vegetables',
                                    thermomix_time: 30,
                                    thermomix_speed: '5',
                                    thermomix_temperature: '100°C',
                                    ingredients: [
                                        {
                                            display_order: 0,
                                            ingredient: {
                                                id: 'ing-1',
                                                name_en: 'Onion',
                                                quantity: 1,
                                                unit_text: 'piece',
                                                image_url: 'https://example.com/onion.jpg',
                                            },
                                        },
                                    ],
                                },
                            ],
                            error: null,
                        });
                } else if (table === 'user_recipe_ingredients') {
                    chain.then = (resolve: Function) =>
                        resolve({
                            data: [
                                {
                                    id: 'ing-1',
                                    name_en: 'Onion',
                                    quantity: 1,
                                    unit_text: 'piece',
                                    image_url: 'https://example.com/onion.jpg',
                                    display_order: 0,
                                },
                            ],
                            error: null,
                        });
                } else if (table === 'user_recipe_tags') {
                    chain.then = (resolve: Function) =>
                        resolve({
                            data: [{ tag_name: 'quick' }, { tag_name: 'healthy' }],
                            error: null,
                        });
                }

                return chain;
            });

            const result = await customRecipeService.load('recipe-123');

            expect(result.id).toBe('recipe-123');
            expect(result.name).toBe('My Recipe');
            expect(result.recipe.totalTime).toBe(30);
            expect(result.recipe.difficulty).toBe('easy');
            expect(result.recipe.ingredients).toHaveLength(1);
            expect(result.recipe.ingredients[0].name).toBe('Onion');
            expect(result.recipe.steps).toHaveLength(1);
            expect(result.recipe.steps[0].instruction).toBe('Chop vegetables');
            expect(result.recipe.steps[0].thermomixTime).toBe(30);
            expect(result.recipe.steps[0].ingredientsUsed).toContain('Onion');
            expect(result.recipe.tags).toEqual(['quick', 'healthy']);
        });

        it('throws when recipe not found', async () => {
            mockSupabaseAuthSuccess();

            const chain = createChainableMock({
                data: null,
                error: { message: 'Not found', code: 'PGRST116' },
            });
            mockClient.from.mockReturnValue(chain);

            await expect(customRecipeService.load('nonexistent-id')).rejects.toThrow(
                'Failed to load recipe'
            );
        });

        it('throws on auth error', async () => {
            mockSupabaseAuthError('Not authenticated');

            await expect(customRecipeService.load('recipe-123')).rejects.toThrow(
                'User not authenticated'
            );
        });
    });

    // ============================================================
    // list() Tests
    // ============================================================

    describe('list', () => {
        it('returns recipes from both schema versions', async () => {
            mockSupabaseAuthSuccess();

            const chain: any = {};
            ['select', 'eq', 'order'].forEach((m) => {
                chain[m] = jest.fn().mockReturnValue(chain);
            });
            chain.limit = jest.fn().mockResolvedValue({
                data: [
                    {
                        id: 'recipe-1',
                        name: 'Recipe 1 (2.0)',
                        source: 'ai_generated',
                        created_at: '2024-01-16T12:00:00Z',
                        schema_version: '2.0',
                        total_time: 30,
                        difficulty: 'easy',
                        recipe_data: null,
                    },
                    {
                        id: 'recipe-2',
                        name: 'Recipe 2 (1.0)',
                        source: 'ai_modified',
                        created_at: '2024-01-15T12:00:00Z',
                        schema_version: '1.0',
                        total_time: null,
                        difficulty: null,
                        recipe_data: { totalTime: 45, difficulty: 'medium' },
                    },
                ],
                error: null,
            });
            mockClient.from.mockReturnValue(chain);

            const result = await customRecipeService.list();

            expect(result).toHaveLength(2);
            // Schema 2.0 uses denormalized columns
            expect(result[0].id).toBe('recipe-1');
            expect(result[0].totalTime).toBe(30);
            expect(result[0].difficulty).toBe('easy');
            // Schema 1.0 falls back to recipe_data
            expect(result[1].id).toBe('recipe-2');
            expect(result[1].totalTime).toBe(45);
            expect(result[1].difficulty).toBe('medium');
        });

        it('handles null recipe_data gracefully for schema 1.0', async () => {
            mockSupabaseAuthSuccess();

            const chain: any = {};
            ['select', 'eq', 'order'].forEach((m) => {
                chain[m] = jest.fn().mockReturnValue(chain);
            });
            chain.limit = jest.fn().mockResolvedValue({
                data: [
                    {
                        id: 'recipe-1',
                        name: 'Recipe 1',
                        source: 'ai_generated',
                        created_at: '2024-01-16T12:00:00Z',
                        schema_version: '1.0',
                        total_time: null,
                        difficulty: null,
                        recipe_data: null,
                    },
                ],
                error: null,
            });
            mockClient.from.mockReturnValue(chain);

            const result = await customRecipeService.list();

            expect(result[0].totalTime).toBeUndefined();
            expect(result[0].difficulty).toBeUndefined();
        });

        it('throws on auth error', async () => {
            mockSupabaseAuthError('Not authenticated');

            await expect(customRecipeService.list()).rejects.toThrow('User not authenticated');
        });
    });

    // ============================================================
    // delete() Tests
    // ============================================================

    describe('delete', () => {
        it('deletes recipe by id (CASCADE handles related tables)', async () => {
            mockSupabaseAuthSuccess();

            // Create a chain that supports .delete().eq().eq() pattern
            const finalResult = { error: null };
            const chain: any = {
                delete: jest.fn(),
                eq: jest.fn(),
            };
            chain.delete.mockReturnValue(chain);
            chain.eq.mockReturnValue({
                eq: jest.fn().mockReturnValue(Promise.resolve(finalResult)),
            });
            mockClient.from.mockReturnValue(chain);

            await customRecipeService.delete('recipe-123');

            expect(mockClient.from).toHaveBeenCalledWith('user_recipes');
            expect(chain.delete).toHaveBeenCalled();
        });

        it('throws on auth error', async () => {
            mockSupabaseAuthError('Not authenticated');

            await expect(customRecipeService.delete('recipe-123')).rejects.toThrow(
                'User not authenticated'
            );
        });

        it('throws on delete error', async () => {
            mockSupabaseAuthSuccess();

            const finalResult = { error: { message: 'Delete failed' } };
            const chain: any = {
                delete: jest.fn(),
                eq: jest.fn(),
            };
            chain.delete.mockReturnValue(chain);
            chain.eq.mockReturnValue({
                eq: jest.fn().mockReturnValue(Promise.resolve(finalResult)),
            });
            mockClient.from.mockReturnValue(chain);

            await expect(customRecipeService.delete('recipe-123')).rejects.toThrow(
                'Failed to delete recipe'
            );
        });
    });
});

import { Share } from 'react-native';
import { router } from 'expo-router';
import { executeAction, resolveActionContext } from '../actionRegistry';
import type { Action } from '@/types/irmixy';
import type { ActionContext, ActionContextSource } from '../actionRegistry';

// Mock react-native Share
jest.mock('react-native', () => ({
    Share: { share: jest.fn().mockResolvedValue({ action: 'sharedAction' }) },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
    router: { push: jest.fn() },
}));

function createAction(overrides: Partial<Action> = {}): Action {
    return {
        id: 'test_123',
        type: 'share_recipe',
        label: 'Share Recipe',
        payload: {},
        ...overrides,
    };
}

describe('actionRegistry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('executeAction', () => {
        it('returns false for unknown action types', () => {
            const action = createAction({ type: 'unknown_type' as any });
            const result = executeAction(action);
            expect(result).toBe(false);
        });

        it('does not throw for unknown action types', () => {
            const action = createAction({ type: 'future_action' as any });
            expect(() => executeAction(action)).not.toThrow();
        });
    });

    describe('view_recipe handler', () => {
        it('navigates to recipe detail with recipeId', () => {
            const action = createAction({
                type: 'view_recipe',
                payload: { recipeId: 'abc-123' },
            });
            const result = executeAction(action);
            expect(result).toBe(true);
            expect(router.push).toHaveBeenCalledWith(
                '/(tabs)/recipes/abc-123?from=chat'
            );
        });

        it('returns false when recipeId is missing', () => {
            const action = createAction({
                type: 'view_recipe',
                payload: {},
            });
            const result = executeAction(action);
            expect(result).toBe(false);
        });
    });

    describe('share_recipe handler', () => {
        it('returns false when no recipe context is provided', async () => {
            const action = createAction({ type: 'share_recipe' });
            const result = await executeAction(action);
            expect(result).toBe(false);
        });

        it('returns false when context has no recipes', async () => {
            const action = createAction({ type: 'share_recipe' });
            const context: ActionContext = {};
            const result = await executeAction(action, context);
            expect(result).toBe(false);
        });

        it('calls Share.share with formatted custom recipe', async () => {
            const action = createAction({ type: 'share_recipe' });
            const context: ActionContext = {
                currentRecipe: {
                    schemaVersion: '1.0',
                    suggestedName: 'Test Pasta',
                    measurementSystem: 'metric',
                    language: 'en',
                    ingredients: [
                        { name: 'Pasta', quantity: 200, unit: 'g' },
                    ],
                    steps: [
                        { order: 1, instruction: 'Boil water' },
                    ],
                    totalTime: 20,
                    difficulty: 'easy',
                    portions: 2,
                    tags: ['quick'],
                },
            };
            const result = await executeAction(action, context);
            expect(result).toBe(true);
            expect(Share.share).toHaveBeenCalledTimes(1);
            const shareCall = (Share.share as jest.Mock).mock.calls[0][0];
            expect(shareCall.message).toContain('Test Pasta');
            expect(shareCall.message).toContain('200 g Pasta');
            expect(shareCall.message).toContain('Boil water');
            expect(shareCall.message).toContain('YummyYummix');
        });

        it('shares recipe card name when no custom recipe', async () => {
            const action = createAction({ type: 'share_recipe' });
            const context: ActionContext = {
                recipes: [
                    {
                        recipeId: 'r-1',
                        name: 'Quick Salad',
                        totalTime: 10,
                        difficulty: 'easy',
                        portions: 2,
                    },
                ],
            };
            const result = await executeAction(action, context);
            expect(result).toBe(true);
            const shareCall = (Share.share as jest.Mock).mock.calls[0][0];
            expect(shareCall.message).toContain('Quick Salad');
        });

        it('handles Share.share failure gracefully', async () => {
            (Share.share as jest.Mock).mockRejectedValueOnce(new Error('User cancelled'));
            const action = createAction({ type: 'share_recipe' });
            const context: ActionContext = {
                currentRecipe: {
                    schemaVersion: '1.0',
                    suggestedName: 'Fail Recipe',
                    measurementSystem: 'metric',
                    language: 'en',
                    ingredients: [],
                    steps: [],
                    totalTime: 10,
                    difficulty: 'easy',
                    portions: 1,
                    tags: [],
                },
            };
            const result = await executeAction(action, context);
            expect(result).toBe(false);
        });
    });

    describe('resolveActionContext', () => {
        it('returns preferred message context when message id has recipe data', () => {
            const messages: ActionContextSource[] = [
                { id: 'm1', role: 'assistant' },
                {
                    id: 'm2',
                    role: 'assistant',
                    customRecipe: {
                        schemaVersion: '1.0',
                        suggestedName: 'Preferred Recipe',
                        measurementSystem: 'metric',
                        language: 'en',
                        ingredients: [],
                        steps: [],
                        totalTime: 15,
                        difficulty: 'easy',
                        portions: 2,
                        tags: [],
                    },
                },
            ];

            const result = resolveActionContext(messages, 'm2');
            expect(result?.currentRecipe?.suggestedName).toBe('Preferred Recipe');
        });

        it('falls back to latest assistant message with recipe data', () => {
            const messages: ActionContextSource[] = [
                { id: 'm1', role: 'assistant' },
                {
                    id: 'm2',
                    role: 'assistant',
                    recipes: [{
                        recipeId: 'recipe-1',
                        name: 'Latest Recipe',
                        totalTime: 10,
                        difficulty: 'easy',
                        portions: 2,
                    }],
                },
            ];

            const result = resolveActionContext(messages, 'missing-id');
            expect(result?.recipes?.[0]?.name).toBe('Latest Recipe');
        });

        it('ignores non-assistant messages when falling back', () => {
            const messages: ActionContextSource[] = [
                {
                    id: 'u1',
                    role: 'user',
                    recipes: [{
                        recipeId: 'recipe-1',
                        name: 'User Recipe',
                        totalTime: 10,
                        difficulty: 'easy',
                        portions: 2,
                    }],
                },
            ];

            const result = resolveActionContext(messages);
            expect(result).toBeUndefined();
        });
    });
});

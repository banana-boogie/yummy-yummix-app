/**
 * pantryService Tests
 *
 * Covers CRUD operations for pantry items and favorites,
 * including response mapping via shared mappers.
 */

import { pantryService } from '../pantryService';
import { shoppingListService } from '../shoppingListService';
import { shoppingListFactory, userFactory } from '@/test/factories';
import { getMockSupabaseClient, mockSupabaseAuthSuccess } from '@/test/mocks/supabase';

// Mock shoppingListService.getCategories used by getPantryItems
jest.mock('../shoppingListService', () => ({
    shoppingListService: {
        getCategories: jest.fn(),
        addItem: jest.fn(),
    },
}));

const mockGetCategories = shoppingListService.getCategories as jest.Mock;

describe('pantryService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getPantryItems', () => {
        it('returns items grouped by category with localizedName', async () => {
            const user = userFactory.createSupabaseUser({ id: 'user-1' });
            mockSupabaseAuthSuccess(user);

            const mockClient = getMockSupabaseClient();
            const rawItems = [
                {
                    id: 'pantry-1',
                    user_id: 'user-1',
                    ingredient_id: 'ing-1',
                    category_id: 'produce',
                    name_custom: null,
                    quantity: '2.00',
                    unit_id: null,
                    created_at: '2025-01-01',
                    updated_at: '2025-01-01',
                    ingredient: { id: 'ing-1', name_en: 'Apple', plural_name_en: 'Apples', picture_url: null },
                    measurement_unit: null,
                },
            ];

            const chainable = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: rawItems, error: null }),
            };
            mockClient.from.mockReturnValue(chainable);

            mockGetCategories.mockResolvedValue([
                shoppingListFactory.createCategory({ id: 'produce', nameEn: 'Produce', nameEs: 'Frutas y Verduras' }),
                shoppingListFactory.createCategory({ id: 'dairy', nameEn: 'Dairy', nameEs: 'Lácteos' }),
            ]);

            const result = await pantryService.getPantryItems();

            // Only produce should be returned (dairy has no items)
            expect(result.categories).toHaveLength(1);
            expect(result.categories[0].id).toBe('produce');
            expect(result.categories[0].localizedName).toBe('Produce');
            expect(result.categories[0].items).toHaveLength(1);
            expect(result.categories[0].items[0].name).toBe('Apple');
            expect(result.categories[0].items[0].quantity).toBe(2);
        });

        it('throws when user not authenticated', async () => {
            const mockClient = getMockSupabaseClient();
            mockClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

            await expect(pantryService.getPantryItems()).rejects.toThrow('User not authenticated');
        });
    });

    describe('addPantryItem', () => {
        it('inserts item and returns mapped result', async () => {
            const user = userFactory.createSupabaseUser({ id: 'user-1' });
            mockSupabaseAuthSuccess(user);

            const mockClient = getMockSupabaseClient();
            const rawInserted = {
                id: 'pantry-new',
                user_id: 'user-1',
                ingredient_id: 'ing-1',
                category_id: 'produce',
                name_custom: null,
                quantity: '3.00',
                unit_id: null,
                created_at: '2025-01-01',
                updated_at: '2025-01-01',
                ingredient: { id: 'ing-1', name_en: 'Banana', plural_name_en: 'Bananas', picture_url: 'https://img.com/banana.jpg' },
                measurement_unit: { id: 'unit-g', type: 'weight', system: 'metric', name_en: 'gram', symbol_en: 'g' },
            };

            const chainable = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: rawInserted, error: null }),
            };
            mockClient.from.mockReturnValue(chainable);

            const result = await pantryService.addPantryItem({
                ingredientId: 'ing-1',
                categoryId: 'produce',
                quantity: 3,
            });

            expect(result.id).toBe('pantry-new');
            expect(result.name).toBe('Banana');
            expect(result.pictureUrl).toBe('https://img.com/banana.jpg');
            expect(result.unit?.symbol).toBe('g');
            expect(result.quantity).toBe(3);
        });

        it('uses name_custom fallback when no ingredient', async () => {
            const user = userFactory.createSupabaseUser({ id: 'user-1' });
            mockSupabaseAuthSuccess(user);

            const mockClient = getMockSupabaseClient();
            const rawInserted = {
                id: 'pantry-custom',
                user_id: 'user-1',
                ingredient_id: null,
                category_id: 'other',
                name_custom: 'Specialty Flour',
                quantity: '1.00',
                unit_id: null,
                created_at: '2025-01-01',
                updated_at: '2025-01-01',
                ingredient: null,
                measurement_unit: null,
            };

            const chainable = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: rawInserted, error: null }),
            };
            mockClient.from.mockReturnValue(chainable);

            const result = await pantryService.addPantryItem({
                categoryId: 'other',
                nameCustom: 'Specialty Flour',
                quantity: 1,
            });

            expect(result.name).toBe('Specialty Flour');
            expect(result.ingredientId).toBeNull();
        });
    });

    describe('updatePantryItem', () => {
        it('sends correct DB updates', async () => {
            const mockClient = getMockSupabaseClient();
            const chainable = {
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            };
            mockClient.from.mockReturnValue(chainable);

            await pantryService.updatePantryItem('pantry-1', { quantity: 5, categoryId: 'dairy' });

            expect(mockClient.from).toHaveBeenCalledWith('pantry_items');
            expect(chainable.update).toHaveBeenCalledWith({ quantity: 5, category_id: 'dairy' });
            expect(chainable.eq).toHaveBeenCalledWith('id', 'pantry-1');
        });
    });

    describe('deletePantryItem', () => {
        it('calls delete with correct ID', async () => {
            const mockClient = getMockSupabaseClient();
            const chainable = {
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            };
            mockClient.from.mockReturnValue(chainable);

            await pantryService.deletePantryItem('pantry-1');

            expect(mockClient.from).toHaveBeenCalledWith('pantry_items');
            expect(chainable.delete).toHaveBeenCalled();
            expect(chainable.eq).toHaveBeenCalledWith('id', 'pantry-1');
        });
    });

    describe('getFavorites', () => {
        it('returns mapped favorites', async () => {
            const user = userFactory.createSupabaseUser({ id: 'user-1' });
            mockSupabaseAuthSuccess(user);

            const mockClient = getMockSupabaseClient();
            const rawFavorites = [
                {
                    id: 'fav-1',
                    user_id: 'user-1',
                    ingredient_id: 'ing-1',
                    category_id: 'dairy',
                    name_custom: null,
                    default_quantity: '2.00',
                    default_unit_id: null,
                    purchase_count: 5,
                    created_at: '2025-01-01',
                    updated_at: '2025-01-01',
                    ingredient: { id: 'ing-1', name_en: 'Milk', plural_name_en: 'Milks', picture_url: null },
                    measurement_unit: null,
                },
            ];

            const chainable = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: rawFavorites, error: null }),
            };
            mockClient.from.mockReturnValue(chainable);

            const result = await pantryService.getFavorites();

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Milk');
            expect(result[0].defaultQuantity).toBe(2);
            expect(result[0].purchaseCount).toBe(5);
        });
    });

    describe('addToFavorites', () => {
        it('inserts and returns mapped favorite', async () => {
            const user = userFactory.createSupabaseUser({ id: 'user-1' });
            mockSupabaseAuthSuccess(user);

            const mockClient = getMockSupabaseClient();
            const rawInserted = {
                id: 'fav-new',
                user_id: 'user-1',
                ingredient_id: 'ing-2',
                category_id: 'produce',
                name_custom: null,
                default_quantity: '1.00',
                default_unit_id: null,
                purchase_count: 1,
                created_at: '2025-01-01',
                updated_at: '2025-01-01',
                ingredient: { id: 'ing-2', name_en: 'Tomato', plural_name_en: 'Tomatoes', picture_url: null },
                measurement_unit: null,
            };

            const chainable = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: rawInserted, error: null }),
            };
            mockClient.from.mockReturnValue(chainable);

            const result = await pantryService.addToFavorites({
                ingredientId: 'ing-2',
                categoryId: 'produce',
                defaultQuantity: 1,
            });

            expect(result.id).toBe('fav-new');
            expect(result.name).toBe('Tomato');
            expect(result.purchaseCount).toBe(1);
        });
    });

    describe('removeFromFavorites', () => {
        it('calls delete with correct ID', async () => {
            const mockClient = getMockSupabaseClient();
            const chainable = {
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            };
            mockClient.from.mockReturnValue(chainable);

            await pantryService.removeFromFavorites('fav-1');

            expect(mockClient.from).toHaveBeenCalledWith('favorite_shopping_items');
            expect(chainable.delete).toHaveBeenCalled();
            expect(chainable.eq).toHaveBeenCalledWith('id', 'fav-1');
        });
    });
});

import { supabase } from '@/lib/supabase';
import { PantryItem, PantryItemCreate, PantryItemUpdate, FavoriteShoppingItem, FavoriteShoppingItemCreate, ShoppingCategory } from '@/types/shopping-list.types';
import { shoppingListService } from './shoppingListService';
import { getCurrentLocale, mapIngredient, mapMeasurementUnit, getLocalizedCategoryName } from './utils/mapSupabaseItem';

const INGREDIENT_JOIN = `
  ingredient:ingredients (
    id,
    image_url,
    translations:ingredient_translations (locale, name, plural_name)
  ),
  measurement_unit:measurement_units (
    id,
    type,
    system,
    translations:measurement_unit_translations (locale, name, name_plural, symbol, symbol_plural)
  )
`;

const PANTRY_SELECT = `
  id, user_id, ingredient_id, category_id, name_custom, quantity, unit_id, created_at, updated_at,
  ${INGREDIENT_JOIN}
`;

const FAVORITE_SELECT = `
  id, user_id, ingredient_id, category_id, name_custom, default_quantity, default_unit_id, purchase_count, created_at, updated_at,
  ${INGREDIENT_JOIN}
`;

export const pantryService = {
    async getPantryItems(): Promise<{ categories: (ShoppingCategory & { localizedName: string; items: PantryItem[] })[] }> {
        const locale = getCurrentLocale();
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('pantry_items')
            .select(PANTRY_SELECT)
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw new Error(`Error fetching pantry items: ${error.message}`);

        const items: PantryItem[] = (data ?? []).map((item: any) => {
            const ingredient = mapIngredient(item.ingredient, locale, item.name_custom);
            return {
                id: item.id,
                userId: item.user_id,
                ingredientId: item.ingredient_id,
                categoryId: item.category_id,
                ...ingredient,
                quantity: parseFloat(item.quantity) || 1,
                unit: mapMeasurementUnit(item.measurement_unit, locale),
                createdAt: item.created_at,
                updatedAt: item.updated_at,
            };
        });

        const categories = await shoppingListService.getCategories();
        const categoriesWithItems = categories.map(cat => ({
            ...cat,
            localizedName: getLocalizedCategoryName(cat),
            items: items.filter(item => item.categoryId === cat.id),
        })).filter(cat => cat.items.length > 0);

        return { categories: categoriesWithItems };
    },

    async addPantryItem(item: PantryItemCreate): Promise<PantryItem> {
        const locale = getCurrentLocale();
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('pantry_items')
            .insert({
                user_id: user.id,
                ingredient_id: item.ingredientId,
                category_id: item.categoryId,
                name_custom: item.nameCustom,
                quantity: item.quantity,
                unit_id: item.unitId,
            })
            .select(PANTRY_SELECT)
            .single();

        if (error) throw new Error(`Error adding pantry item: ${error.message}`);

        const row = data as any;
        const ingredient = mapIngredient(row.ingredient, locale, row.name_custom);
        return {
            id: row.id,
            userId: row.user_id,
            ingredientId: row.ingredient_id,
            categoryId: row.category_id,
            ...ingredient,
            quantity: parseFloat(row.quantity) || 1,
            unit: mapMeasurementUnit(row.measurement_unit, locale),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },

    async updatePantryItem(itemId: string, updates: PantryItemUpdate): Promise<void> {
        const dbUpdates: Record<string, any> = {};
        if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
        if (updates.unitId !== undefined) dbUpdates.unit_id = updates.unitId;
        if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;

        const { error } = await supabase.from('pantry_items').update(dbUpdates).eq('id', itemId);
        if (error) throw new Error(`Error updating pantry item: ${error.message}`);
    },

    async deletePantryItem(itemId: string): Promise<void> {
        const { error } = await supabase.from('pantry_items').delete().eq('id', itemId);
        if (error) throw new Error(`Error deleting pantry item: ${error.message}`);
    },

    async getFavorites(): Promise<FavoriteShoppingItem[]> {
        const locale = getCurrentLocale();
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('favorite_shopping_items')
            .select(FAVORITE_SELECT)
            .eq('user_id', user.id)
            .order('purchase_count', { ascending: false });

        if (error) throw new Error(`Error fetching favorites: ${error.message}`);

        return (data ?? []).map((item: any) => {
            const ingredient = mapIngredient(item.ingredient, locale, item.name_custom);
            return {
                id: item.id,
                userId: item.user_id,
                ingredientId: item.ingredient_id,
                categoryId: item.category_id,
                ...ingredient,
                defaultQuantity: parseFloat(item.default_quantity) || 1,
                defaultUnit: mapMeasurementUnit(item.measurement_unit, locale),
                purchaseCount: item.purchase_count,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
            };
        });
    },

    async addToFavorites(item: FavoriteShoppingItemCreate): Promise<FavoriteShoppingItem> {
        const locale = getCurrentLocale();
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('favorite_shopping_items')
            .insert({
                user_id: user.id,
                ingredient_id: item.ingredientId,
                category_id: item.categoryId,
                name_custom: item.nameCustom,
                default_quantity: item.defaultQuantity,
                default_unit_id: item.defaultUnitId,
            })
            .select(FAVORITE_SELECT)
            .single();

        if (error) throw new Error(`Error adding to favorites: ${error.message}`);

        const row = data as any;
        const ingredient = mapIngredient(row.ingredient, locale, row.name_custom);
        return {
            id: row.id,
            userId: row.user_id,
            ingredientId: row.ingredient_id,
            categoryId: row.category_id,
            ...ingredient,
            defaultQuantity: parseFloat(row.default_quantity) || 1,
            defaultUnit: mapMeasurementUnit(row.measurement_unit, locale),
            purchaseCount: row.purchase_count,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },

    async removeFromFavorites(favoriteId: string): Promise<void> {
        const { error } = await supabase
            .from('favorite_shopping_items')
            .delete()
            .eq('id', favoriteId);

        if (error) throw new Error(`Error removing from favorites: ${error.message}`);
    },

    async addFavoriteToList(favoriteId: string, shoppingListId: string): Promise<void> {
        const locale = getCurrentLocale();
        const { data, error } = await supabase
            .from('favorite_shopping_items')
            .select(`
                id, ingredient_id, category_id, name_custom, default_quantity, default_unit_id, purchase_count,
                ${INGREDIENT_JOIN}
            `)
            .eq('id', favoriteId)
            .single();

        if (error || !data) throw new Error('Favorite not found');

        const row = data as any;
        const ingredient = mapIngredient(row.ingredient, locale, row.name_custom);

        await shoppingListService.addItem({
            shoppingListId,
            ingredientId: row.ingredient_id,
            categoryId: row.category_id,
            nameCustom: row.ingredient_id ? undefined : ingredient.name,
            quantity: parseFloat(row.default_quantity) || 1,
            unitId: row.default_unit_id,
        });

        await supabase
            .from('favorite_shopping_items')
            .update({ purchase_count: (row.purchase_count ?? 0) + 1 })
            .eq('id', favoriteId);
    },
};

export default pantryService;

import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import { PantryItem, PantryItemCreate, PantryItemUpdate, FavoriteShoppingItem, FavoriteShoppingItemCreate, ShoppingCategory } from '@/types/shopping-list.types';
import { MeasurementUnit } from '@/types/recipe.types';
import { shoppingListService } from './shoppingListService';

const getLangSuffix = () => `_${i18n.locale}`;

export const pantryService = {
    async getPantryItems(): Promise<{ categories: (ShoppingCategory & { items: PantryItem[] })[] }> {
        const lang = getLangSuffix();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('pantry_items')
            .select(`
        id, user_id, ingredient_id, category_id, name_custom, quantity, unit_id, created_at, updated_at,
        ingredient:ingredients (id, name${lang}, plural_name${lang}, picture_url),
        measurement_unit:measurement_units (id, type, system, symbol${lang}, name${lang}, name${lang}_plural)
      `)
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw new Error(`Error fetching pantry items: ${error.message}`);

        const items: PantryItem[] = (data ?? []).map((item: any) => ({
            id: item.id,
            userId: item.user_id,
            ingredientId: item.ingredient_id,
            categoryId: item.category_id,
            name: item.ingredient?.[`name${lang}`] ?? item.name_custom ?? '',
            pluralName: item.ingredient?.[`plural_name${lang}`],
            pictureUrl: item.ingredient?.picture_url,
            quantity: parseFloat(item.quantity) || 1,
            unit: item.measurement_unit ? {
                id: item.measurement_unit.id,
                type: item.measurement_unit.type,
                system: item.measurement_unit.system,
                name: item.measurement_unit[`name${lang}`],
                symbol: item.measurement_unit[`symbol${lang}`],
            } as MeasurementUnit : undefined,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
        }));

        const categories = await shoppingListService.getCategories();
        const categoriesWithItems = categories.map(cat => ({
            ...cat,
            items: items.filter(item => item.categoryId === cat.id),
        })).filter(cat => cat.items.length > 0);

        return { categories: categoriesWithItems };
    },

    async addPantryItem(item: PantryItemCreate): Promise<PantryItem> {
        const lang = getLangSuffix();
        const { data: { user } } = await supabase.auth.getUser();
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
            .select(`
        id, user_id, ingredient_id, category_id, name_custom, quantity, unit_id, created_at, updated_at,
        ingredient:ingredients (id, name${lang}, plural_name${lang}, picture_url),
        measurement_unit:measurement_units (id, type, system, symbol${lang}, name${lang}, name${lang}_plural)
      `)
            .single();

        if (error) throw new Error(`Error adding pantry item: ${error.message}`);

        return {
            id: data.id,
            userId: data.user_id,
            ingredientId: data.ingredient_id,
            categoryId: data.category_id,
            name: (data.ingredient as any)?.[`name${lang}`] ?? data.name_custom ?? '',
            pluralName: (data.ingredient as any)?.[`plural_name${lang}`],
            pictureUrl: (data.ingredient as any)?.picture_url,
            quantity: parseFloat(data.quantity) || 1,
            unit: data.measurement_unit ? {
                id: (data.measurement_unit as any).id,
                type: (data.measurement_unit as any).type,
                system: (data.measurement_unit as any).system,
                name: (data.measurement_unit as any)[`name${lang}`],
                symbol: (data.measurement_unit as any)[`symbol${lang}`],
            } as MeasurementUnit : undefined,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
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
        const lang = getLangSuffix();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('favorite_shopping_items')
            .select(`
        id, user_id, ingredient_id, category_id, name_custom, default_quantity, default_unit_id, purchase_count, created_at, updated_at,
        ingredient:ingredients (id, name${lang}, plural_name${lang}, picture_url),
        measurement_unit:measurement_units (id, type, system, symbol${lang}, name${lang}, name${lang}_plural)
      `)
            .eq('user_id', user.id)
            .order('purchase_count', { ascending: false });

        if (error) throw new Error(`Error fetching favorites: ${error.message}`);

        return (data ?? []).map((item: any) => ({
            id: item.id,
            userId: item.user_id,
            ingredientId: item.ingredient_id,
            categoryId: item.category_id,
            name: item.ingredient?.[`name${lang}`] ?? item.name_custom ?? '',
            pluralName: item.ingredient?.[`plural_name${lang}`],
            pictureUrl: item.ingredient?.picture_url,
            defaultQuantity: parseFloat(item.default_quantity) || 1,
            defaultUnit: item.measurement_unit ? {
                id: item.measurement_unit.id,
                type: item.measurement_unit.type,
                system: item.measurement_unit.system,
                name: item.measurement_unit[`name${lang}`],
                symbol: item.measurement_unit[`symbol${lang}`],
            } as MeasurementUnit : undefined,
            purchaseCount: item.purchase_count,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
        }));
    },

    async addToFavorites(item: FavoriteShoppingItemCreate): Promise<FavoriteShoppingItem> {
        const lang = getLangSuffix();
        const { data: { user } } = await supabase.auth.getUser();
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
            .select(`
        id, user_id, ingredient_id, category_id, name_custom, default_quantity, default_unit_id, purchase_count, created_at, updated_at,
        ingredient:ingredients (id, name${lang}, plural_name${lang}, picture_url),
        measurement_unit:measurement_units (id, type, system, symbol${lang}, name${lang}, name${lang}_plural)
      `)
            .single();

        if (error) throw new Error(`Error adding to favorites: ${error.message}`);

        return {
            id: data.id,
            userId: data.user_id,
            ingredientId: data.ingredient_id,
            categoryId: data.category_id,
            name: (data.ingredient as any)?.[`name${lang}`] ?? data.name_custom ?? '',
            pluralName: (data.ingredient as any)?.[`plural_name${lang}`],
            pictureUrl: (data.ingredient as any)?.picture_url,
            defaultQuantity: parseFloat(data.default_quantity) || 1,
            defaultUnit: data.measurement_unit ? {
                id: (data.measurement_unit as any).id,
                type: (data.measurement_unit as any).type,
                system: (data.measurement_unit as any).system,
                name: (data.measurement_unit as any)[`name${lang}`],
                symbol: (data.measurement_unit as any)[`symbol${lang}`],
            } as MeasurementUnit : undefined,
            purchaseCount: data.purchase_count,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
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
        const favorites = await this.getFavorites();
        const favorite = favorites.find(f => f.id === favoriteId);
        if (!favorite) throw new Error('Favorite not found');

        await shoppingListService.addItem({
            shoppingListId,
            ingredientId: favorite.ingredientId,
            categoryId: favorite.categoryId,
            nameCustom: favorite.ingredientId ? undefined : favorite.name,
            quantity: favorite.defaultQuantity,
            unitId: favorite.defaultUnit?.id,
        });

        await supabase
            .from('favorite_shopping_items')
            .update({ purchase_count: favorite.purchaseCount + 1 })
            .eq('id', favoriteId);
    },
};

export default pantryService;

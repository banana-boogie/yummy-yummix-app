import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import {
    ShoppingList,
    ShoppingListItem,
    ShoppingListItemCreate,
    ShoppingListItemUpdate,
    ShoppingListWithItems,
    ShoppingCategory,
    ShoppingCategoryWithItems,
    ConsolidationResult,
    IngredientSuggestion,
} from '@/types/shopping-list.types';
import { MeasurementUnit } from '@/types/recipe.types';

const getLangSuffix = () => `_${i18n.locale}`;

export const shoppingListService = {
    async getShoppingLists(includeArchived = false): Promise<ShoppingList[]> {
        let query = supabase
            .from('shopping_lists')
            .select(`id, user_id, name, is_archived, created_at, updated_at, items:shopping_list_items(count)`)
            .order('updated_at', { ascending: false });

        if (!includeArchived) {
            query = query.eq('is_archived', false);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Error fetching shopping lists: ${error.message}`);

        const listsWithCounts = await Promise.all(
            (data ?? []).map(async (list: any) => {
                const { count: checkedCount } = await supabase
                    .from('shopping_list_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('shopping_list_id', list.id)
                    .eq('is_checked', true);

                return {
                    id: list.id,
                    userId: list.user_id,
                    name: list.name,
                    isArchived: list.is_archived,
                    itemCount: list.items?.[0]?.count ?? 0,
                    checkedCount: checkedCount ?? 0,
                    createdAt: list.created_at,
                    updatedAt: list.updated_at,
                };
            })
        );

        return listsWithCounts;
    },

    async getShoppingListById(id: string): Promise<ShoppingListWithItems | null> {
        const lang = getLangSuffix();

        const { data: listData, error: listError } = await supabase
            .from('shopping_lists')
            .select('id, user_id, name, is_archived, created_at, updated_at')
            .eq('id', id)
            .single();

        if (listError) throw new Error(`Error fetching shopping list: ${listError.message}`);
        if (!listData) return null;

        const { data: itemsData, error: itemsError } = await supabase
            .from('shopping_list_items')
            .select(`
        id, shopping_list_id, ingredient_id, category_id, name_custom, quantity, unit_id, notes, is_checked, checked_at, recipe_id, display_order, created_at, updated_at,
        ingredient:ingredients (id, name${lang}, plural_name${lang}, picture_url),
        measurement_unit:measurement_units (id, type, system, symbol${lang}, name${lang}, name${lang}_plural)
      `)
            .eq('shopping_list_id', id)
            .order('display_order', { ascending: true });

        if (itemsError) throw new Error(`Error fetching shopping list items: ${itemsError.message}`);

        const categories = await this.getCategories();

        const items: ShoppingListItem[] = (itemsData ?? []).map((item: any) => ({
            id: item.id,
            shoppingListId: item.shopping_list_id,
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
            notes: item.notes,
            isChecked: item.is_checked,
            checkedAt: item.checked_at,
            recipeId: item.recipe_id,
            displayOrder: item.display_order,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
        }));

        const categoriesWithItems: ShoppingCategoryWithItems[] = categories.map(category => ({
            ...category,
            localizedName: i18n.locale === 'es' ? category.nameEs : category.nameEn,
            items: items.filter(item => item.categoryId === category.id),
        })).filter(category => category.items.length > 0);

        return {
            id: listData.id,
            userId: listData.user_id,
            name: listData.name,
            isArchived: listData.is_archived,
            itemCount: items.length,
            checkedCount: items.filter(item => item.isChecked).length,
            createdAt: listData.created_at,
            updatedAt: listData.updated_at,
            items,
            categories: categoriesWithItems,
        };
    },

    async createShoppingList(name: string): Promise<ShoppingList> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('shopping_lists')
            .insert({ user_id: user.id, name })
            .select()
            .single();

        if (error) throw new Error(`Error creating shopping list: ${error.message}`);

        return {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            isArchived: data.is_archived,
            itemCount: 0,
            checkedCount: 0,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
    },

    async deleteShoppingList(id: string): Promise<void> {
        const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
        if (error) throw new Error(`Error deleting shopping list: ${error.message}`);
    },

    async addItem(item: ShoppingListItemCreate): Promise<ShoppingListItem> {
        const lang = getLangSuffix();

        const { data: maxOrderData } = await supabase
            .from('shopping_list_items')
            .select('display_order')
            .eq('shopping_list_id', item.shoppingListId)
            .eq('category_id', item.categoryId)
            .order('display_order', { ascending: false })
            .limit(1)
            .single();

        const displayOrder = (maxOrderData?.display_order ?? 0) + 1;

        const { data, error } = await supabase
            .from('shopping_list_items')
            .insert({
                shopping_list_id: item.shoppingListId,
                ingredient_id: item.ingredientId,
                category_id: item.categoryId,
                name_custom: item.nameCustom,
                quantity: item.quantity,
                unit_id: item.unitId,
                notes: item.notes,
                recipe_id: item.recipeId,
                display_order: displayOrder,
            })
            .select(`
        id, shopping_list_id, ingredient_id, category_id, name_custom, quantity, unit_id, notes, is_checked, checked_at, recipe_id, display_order, created_at, updated_at,
        ingredient:ingredients (id, name${lang}, plural_name${lang}, picture_url),
        measurement_unit:measurement_units (id, type, system, symbol${lang}, name${lang}, name${lang}_plural)
      `)
            .single();

        if (error) throw new Error(`Error adding item: ${error.message}`);

        return {
            id: data.id,
            shoppingListId: data.shopping_list_id,
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
            notes: data.notes,
            isChecked: data.is_checked,
            checkedAt: data.checked_at,
            recipeId: data.recipe_id,
            displayOrder: data.display_order,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
    },

    async updateItem(itemId: string, updates: ShoppingListItemUpdate): Promise<void> {
        const dbUpdates: Record<string, any> = {};
        if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
        if (updates.unitId !== undefined) dbUpdates.unit_id = updates.unitId;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.isChecked !== undefined) dbUpdates.is_checked = updates.isChecked;
        if (updates.displayOrder !== undefined) dbUpdates.display_order = updates.displayOrder;
        if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;

        const { error } = await supabase.from('shopping_list_items').update(dbUpdates).eq('id', itemId);
        if (error) throw new Error(`Error updating item: ${error.message}`);
    },

    async toggleItemChecked(itemId: string, isChecked: boolean): Promise<void> {
        await this.updateItem(itemId, { isChecked });
    },

    async deleteItem(itemId: string): Promise<void> {
        const { error } = await supabase.from('shopping_list_items').delete().eq('id', itemId);
        if (error) throw new Error(`Error deleting item: ${error.message}`);
    },

    async consolidateItems(shoppingListId: string): Promise<ConsolidationResult> {
        const list = await this.getShoppingListById(shoppingListId);
        if (!list) throw new Error('Shopping list not found');

        const itemGroups = new Map<string, ShoppingListItem[]>();
        for (const item of list.items) {
            if (!item.ingredientId) continue;
            const key = `${item.ingredientId}-${item.unit?.id ?? 'no-unit'}`;
            const group = itemGroups.get(key) ?? [];
            group.push(item);
            itemGroups.set(key, group);
        }

        let mergedCount = 0;
        for (const [, items] of itemGroups) {
            if (items.length <= 1) continue;
            const primary = items[0];
            const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
            await this.updateItem(primary.id, { quantity: totalQuantity });
            for (let i = 1; i < items.length; i++) {
                await this.deleteItem(items[i].id);
                mergedCount++;
            }
        }

        const updatedList = await this.getShoppingListById(shoppingListId);
        return { merged: mergedCount, items: updatedList?.items ?? [] };
    },

    async getCategories(): Promise<ShoppingCategory[]> {
        const { data: { user } } = await supabase.auth.getUser();

        const { data: categories, error: catError } = await supabase
            .from('shopping_list_categories')
            .select('id, name_en, name_es, icon, display_order')
            .order('display_order', { ascending: true });

        if (catError) throw new Error(`Error fetching categories: ${catError.message}`);

        if (user) {
            const { data: userOrder } = await supabase
                .from('user_category_order')
                .select('category_id, display_order')
                .eq('user_id', user.id);

            if (userOrder && userOrder.length > 0) {
                const orderMap = new Map(userOrder.map(o => [o.category_id, o.display_order]));
                return (categories ?? [])
                    .map(cat => ({
                        id: cat.id,
                        nameEn: cat.name_en,
                        nameEs: cat.name_es,
                        icon: cat.icon,
                        displayOrder: orderMap.get(cat.id) ?? cat.display_order,
                    }))
                    .sort((a, b) => a.displayOrder - b.displayOrder);
            }
        }

        return (categories ?? []).map(cat => ({
            id: cat.id,
            nameEn: cat.name_en,
            nameEs: cat.name_es,
            icon: cat.icon,
            displayOrder: cat.display_order,
        }));
    },

    async searchIngredients(query: string, limit = 10): Promise<IngredientSuggestion[]> {
        const lang = getLangSuffix();

        const { data, error } = await supabase
            .from('ingredients')
            .select(`id, name${lang}, plural_name${lang}, picture_url`)
            .ilike(`name${lang}`, `%${query}%`)
            .limit(limit);

        if (error) throw new Error(`Error searching ingredients: ${error.message}`);

        return (data ?? []).map((ing: any) => ({
            id: ing.id,
            name: ing[`name${lang}`],
            pluralName: ing[`plural_name${lang}`],
            pictureUrl: ing.picture_url,
            categoryId: 'other',
        }));
    },

    async updateItemsOrder(updates: Array<{ id: string; displayOrder: number }>): Promise<void> {
        // Batch update using Promise.all for performance
        const promises = updates.map(({ id, displayOrder }) =>
            supabase
                .from('shopping_list_items')
                .update({ display_order: displayOrder })
                .eq('id', id)
        );

        const results = await Promise.all(promises);

        // Check for errors
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            throw new Error(`Error updating item order: ${errors[0].error.message}`);
        }
    },
};

export default shoppingListService;

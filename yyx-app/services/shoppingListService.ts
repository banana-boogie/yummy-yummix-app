import { supabase } from '@/lib/supabase';
import {
    ShoppingList,
    ShoppingListItem,
    ShoppingListItemCreate,
    ShoppingListItemUpdate,
    ShoppingListWithItems,
    ShoppingCategory,
    ShoppingCategoryWithItems,
    IngredientSuggestion,
} from '@/types/shopping-list.types';
import {
    shoppingListDetailCache,
    shoppingListsSummaryCache,
    shoppingCategoryCache,
    invalidateAllShoppingListCaches,
} from './cache/shoppingListCache';
import { getCurrentLocale, mapIngredient, mapMeasurementUnit, getLocalizedCategoryName } from './utils/mapSupabaseItem';
import type { MeasurementUnit } from '@/types/recipe.types';

// Module-scope cache — units are static, ~30 rows; no need for AsyncStorage.
let measurementUnitsCache: MeasurementUnit[] | null = null;
// Module-scope cache for the full ingredient catalogue. ingredient_translations
// is a few hundred rows per locale — fetching once per session and filtering
// in memory beats per-keystroke ilike queries. Keyed by locale so a language
// switch doesn't serve stale Spanish names to an English-language user.
const ingredientsCache = new Map<string, IngredientSuggestion[]>();

const ITEM_SELECT = `
  id, shopping_list_id, ingredient_id, category_id, name_custom, quantity, unit_id, notes, is_checked, checked_at, recipe_id, display_order, created_at, updated_at,
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

const getCurrentUserId = async (): Promise<string | undefined> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
};

const invalidateShoppingCaches = async (userId: string | undefined, listId?: string): Promise<void> => {
    if (!userId) return;
    if (listId) {
        await Promise.all([
            shoppingListDetailCache.invalidateList(listId, userId),
            shoppingListsSummaryCache.invalidateLists(userId),
        ]);
        return;
    }
    await invalidateAllShoppingListCaches(userId);
};

export const shoppingListService = {
    async getShoppingLists(includeArchived = false, useCache = true): Promise<ShoppingList[]> {
        const userId = await getCurrentUserId();
        // Try cache first
        if (useCache && userId) {
            const cached = await shoppingListsSummaryCache.getLists(includeArchived, userId);
            if (cached) {
                return cached;
            }
        }

        let query = supabase
            .from('shopping_lists')
            .select(`
                id, user_id, name, is_archived, created_at, updated_at,
                items:shopping_list_items(id, is_checked)
            `)
            .order('updated_at', { ascending: false });

        if (!includeArchived) {
            query = query.eq('is_archived', false);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Error fetching shopping lists: ${error.message}`);

        const result = (data ?? []).map((list: any) => {
            const items = list.items ?? [];
            return {
                id: list.id,
                userId: list.user_id,
                name: list.name,
                isArchived: list.is_archived,
                itemCount: items.length,
                checkedCount: items.filter((i: any) => i.is_checked).length,
                createdAt: list.created_at,
                updatedAt: list.updated_at,
            };
        });

        // Cache the result
        if (userId) {
            await shoppingListsSummaryCache.setLists(result, includeArchived, userId);
        }

        return result;
    },

    async getShoppingListById(id: string, useCache = true): Promise<ShoppingListWithItems | null> {
        const userId = await getCurrentUserId();
        // Try cache first
        if (useCache && userId) {
            const cached = await shoppingListDetailCache.getList(id, userId);
            if (cached) {
                return cached;
            }
        }

        const locale = getCurrentLocale();

        const { data: listData, error: listError } = await supabase
            .from('shopping_lists')
            .select('id, user_id, name, is_archived, created_at, updated_at')
            .eq('id', id)
            .single();

        if (listError) throw new Error(`Error fetching shopping list: ${listError.message}`);
        if (!listData) return null;

        const { data: itemsData, error: itemsError } = await supabase
            .from('shopping_list_items')
            .select(ITEM_SELECT)
            .eq('shopping_list_id', id);

        if (itemsError) throw new Error(`Error fetching shopping list items: ${itemsError.message}`);

        const categories = await this.getCategories();

        const items: ShoppingListItem[] = (itemsData ?? []).map((item: any) => {
            const ingredient = mapIngredient(item.ingredient, locale, item.name_custom);
            return {
                id: item.id,
                shoppingListId: item.shopping_list_id,
                ingredientId: item.ingredient_id,
                categoryId: item.category_id,
                ...ingredient,
                quantity: parseFloat(item.quantity) || 1,
                unit: mapMeasurementUnit(item.measurement_unit, locale),
                notes: item.notes,
                isChecked: item.is_checked,
                checkedAt: item.checked_at,
                recipeId: item.recipe_id,
                displayOrder: item.display_order,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
            };
        });

        const categoriesWithItems: ShoppingCategoryWithItems[] = categories.map(category => ({
            ...category,
            localizedName: getLocalizedCategoryName(category),
            items: items
                .filter(item => item.categoryId === category.id)
                .sort((a, b) => a.name.localeCompare(b.name)),
        })).filter(category => category.items.length > 0);

        const result: ShoppingListWithItems = {
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

        // Cache the result
        if (userId) {
            await shoppingListDetailCache.setList(id, result, userId);
        }

        return result;
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

        await shoppingListsSummaryCache.invalidateLists(user.id);

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
        const userId = await getCurrentUserId();
        await invalidateShoppingCaches(userId, id);
    },

    async addItem(item: ShoppingListItemCreate): Promise<ShoppingListItem> {
        const locale = getCurrentLocale();

        const { data: maxOrderData } = await supabase
            .from('shopping_list_items')
            .select('display_order')
            .eq('shopping_list_id', item.shoppingListId)
            .eq('category_id', item.categoryId)
            .order('display_order', { ascending: false })
            .limit(1)
            .maybeSingle();

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
            .select(ITEM_SELECT)
            .single();

        if (error) throw new Error(`Error adding item: ${error.message}`);

        const userId = await getCurrentUserId();
        await invalidateShoppingCaches(userId, item.shoppingListId);

        const ingredient = mapIngredient(data.ingredient as any, locale, data.name_custom);
        return {
            id: data.id,
            shoppingListId: data.shopping_list_id,
            ingredientId: data.ingredient_id,
            categoryId: data.category_id,
            ...ingredient,
            quantity: parseFloat(data.quantity) || 1,
            unit: mapMeasurementUnit(data.measurement_unit as any, locale),
            notes: data.notes,
            isChecked: data.is_checked,
            checkedAt: data.checked_at,
            recipeId: data.recipe_id,
            displayOrder: data.display_order,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
    },

    async updateItem(itemId: string, updates: ShoppingListItemUpdate, listId?: string): Promise<void> {
        const dbUpdates: Record<string, any> = {};
        if (updates.nameCustom !== undefined) dbUpdates.name_custom = updates.nameCustom;
        if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
        if (updates.unitId !== undefined) dbUpdates.unit_id = updates.unitId;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.isChecked !== undefined) dbUpdates.is_checked = updates.isChecked;
        if (updates.displayOrder !== undefined) dbUpdates.display_order = updates.displayOrder;
        if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;

        const { error } = await supabase.from('shopping_list_items').update(dbUpdates).eq('id', itemId);
        if (error) throw new Error(`Error updating item: ${error.message}`);
        const userId = await getCurrentUserId();
        await invalidateShoppingCaches(userId, listId);
    },

    async toggleItemChecked(itemId: string, isChecked: boolean, listId?: string): Promise<void> {
        await this.updateItem(itemId, { isChecked }, listId);
    },

    async deleteItem(itemId: string, listId?: string): Promise<void> {
        const { error } = await supabase.from('shopping_list_items').delete().eq('id', itemId);
        if (error) throw new Error(`Error deleting item: ${error.message}`);
        const userId = await getCurrentUserId();
        await invalidateShoppingCaches(userId, listId);
    },

    async getCategories(useCache = true): Promise<ShoppingCategory[]> {
        // Try cache first (categories are static)
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        if (useCache && userId) {
            const cached = await shoppingCategoryCache.getCategories(userId);
            if (cached) {
                return cached;
            }
        }

        const { data: categories, error: catError } = await supabase
            .from('shopping_list_categories')
            .select('id, name_en, name_es, icon, display_order')
            .order('display_order', { ascending: true });

        if (catError) throw new Error(`Error fetching categories: ${catError.message}`);

        let result: ShoppingCategory[];

        if (user) {
            const { data: userOrder } = await supabase
                .from('user_category_order')
                .select('category_id, display_order')
                .eq('user_id', user.id);

            if (userOrder && userOrder.length > 0) {
                const orderMap = new Map(userOrder.map(o => [o.category_id, o.display_order]));
                result = (categories ?? [])
                    .map(cat => ({
                        id: cat.id,
                        nameEn: cat.name_en,
                        nameEs: cat.name_es,
                        icon: cat.icon,
                        displayOrder: orderMap.get(cat.id) ?? cat.display_order,
                    }))
                    .sort((a, b) => a.displayOrder - b.displayOrder);

                // Cache the result
                if (userId) {
                    await shoppingCategoryCache.setCategories(result, userId);
                }
                return result;
            }
        }

        result = (categories ?? []).map(cat => ({
            id: cat.id,
            nameEn: cat.name_en,
            nameEs: cat.name_es,
            icon: cat.icon,
            displayOrder: cat.display_order,
        }));

        // Cache the result
        if (userId) {
            await shoppingCategoryCache.setCategories(result, userId);
        }
        return result;
    },

    async getMeasurementUnits(useCache = true): Promise<MeasurementUnit[]> {
        if (useCache && measurementUnitsCache) return measurementUnitsCache;
        const locale = getCurrentLocale();
        const { data, error } = await supabase
            .from('measurement_units')
            .select(`
                id, type, system,
                translations:measurement_unit_translations (locale, name, name_plural, symbol, symbol_plural)
            `);
        if (error) throw new Error(`Error fetching units: ${error.message}`);
        const units = (data ?? []).map((row: any) => mapMeasurementUnit(row, locale)).filter((u: MeasurementUnit | undefined): u is MeasurementUnit => Boolean(u));
        measurementUnitsCache = units;
        return units;
    },

    /**
     * Fetches every ingredient translation for the current locale and caches
     * the result for the session. Used to power instant client-side search in
     * AddItemModal. Set useCache=false to force a refetch (e.g. after the
     * admin tools touch the ingredient catalogue).
     */
    async getAllIngredients(useCache = true): Promise<IngredientSuggestion[]> {
        const locale = getCurrentLocale();
        if (useCache) {
            const cached = ingredientsCache.get(locale);
            if (cached) return cached;
        }
        const { data, error } = await supabase
            .from('ingredient_translations')
            .select(`
                ingredient_id,
                name,
                plural_name,
                ingredient:ingredients (id, image_url, default_category_id)
            `)
            .eq('locale', locale);
        if (error) throw new Error(`Error loading ingredients: ${error.message}`);
        const rows: IngredientSuggestion[] = (data ?? []).map((row: any) => ({
            id: row.ingredient_id,
            name: row.name,
            pluralName: row.plural_name ?? undefined,
            pictureUrl: row.ingredient?.image_url,
            categoryId: row.ingredient?.default_category_id ?? 'other',
        }));
        ingredientsCache.set(locale, rows);
        return rows;
    },

    /**
     * Pure in-memory filter over an ingredient list. Matches singular and
     * plural names case-insensitively. Sort: starts-with hits first (Lupita
     * typed the start of the word she means), then contains, capped at limit.
     */
    searchIngredientsLocal(
        query: string,
        ingredients: IngredientSuggestion[],
        limit = 10,
    ): IngredientSuggestion[] {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const startsWith: IngredientSuggestion[] = [];
        const contains: IngredientSuggestion[] = [];
        for (const ing of ingredients) {
            const name = ing.name.toLowerCase();
            const plural = ing.pluralName?.toLowerCase() ?? '';
            if (name.startsWith(q) || (plural && plural.startsWith(q))) {
                startsWith.push(ing);
            } else if (name.includes(q) || (plural && plural.includes(q))) {
                contains.push(ing);
            }
        }
        return [...startsWith, ...contains].slice(0, limit);
    },

    async searchIngredients(query: string, limit = 10): Promise<IngredientSuggestion[]> {
        const locale = getCurrentLocale();

        const sanitizedQuery = query
            .replace(/[%_\\]/g, '\\$&')
            .trim();

        if (!sanitizedQuery) return [];

        const { data, error } = await supabase
            .from('ingredient_translations')
            .select(`
                ingredient_id,
                name,
                plural_name,
                ingredient:ingredients (id, image_url)
            `)
            .eq('locale', locale)
            .ilike('name', `%${sanitizedQuery}%`)
            .limit(limit);

        if (error) throw new Error(`Error searching ingredients: ${error.message}`);

        return (data ?? []).map((row: any) => ({
            id: row.ingredient_id,
            name: row.name,
            pluralName: row.plural_name ?? undefined,
            pictureUrl: row.ingredient?.image_url,
            categoryId: 'other',
        }));
    },

    async batchDeleteItems(itemIds: string[], listId?: string): Promise<void> {
        if (itemIds.length === 0) return;

        const { error } = await supabase
            .from('shopping_list_items')
            .delete()
            .in('id', itemIds);

        if (error) throw new Error(`Error batch deleting items: ${error.message}`);
        const userId = await getCurrentUserId();
        await invalidateShoppingCaches(userId, listId);
    },

    async batchUpdateItems(itemIds: string[], updates: { isChecked: boolean }, listId?: string): Promise<void> {
        if (itemIds.length === 0) return;

        const dbUpdates: Record<string, any> = {};
        if (updates.isChecked !== undefined) {
            dbUpdates.is_checked = updates.isChecked;
            if (updates.isChecked) {
                dbUpdates.checked_at = new Date().toISOString();
            }
        }

        const { error } = await supabase
            .from('shopping_list_items')
            .update(dbUpdates)
            .in('id', itemIds);

        if (error) throw new Error(`Error batch updating items: ${error.message}`);
        const userId = await getCurrentUserId();
        await invalidateShoppingCaches(userId, listId);
    },

    /**
     * Adds a batch of recipe ingredients to a shopping list, consolidating
     * with any existing rows that share the same ingredient_id + unit_id by
     * summing quantities. Rows with different units stay as separate entries.
     * Items without an ingredient_id fall back to insert-only (no dedupe).
     */
    async addRecipeIngredients(
        listId: string,
        ingredients: {
            ingredientId?: string | null;
            name?: string;
            quantity: number;
            unitId?: string | null;
            categoryId?: string;
            recipeId?: string | null;
        }[],
    ): Promise<void> {
        if (ingredients.length === 0) return;

        const { data: existing, error: existingErr } = await supabase
            .from('shopping_list_items')
            .select('id, ingredient_id, unit_id, quantity')
            .eq('shopping_list_id', listId);
        if (existingErr) {
            throw new Error(`Load list failed: ${existingErr.message}`);
        }
        const existingRows = (existing ?? []) as {
            id: string;
            ingredient_id: string | null;
            unit_id: string | null;
            quantity: number | string | null;
        }[];
        const keyOf = (ingredientId: string | null, unitId: string | null) =>
            `${ingredientId ?? ''}:${unitId ?? ''}`;
        const byKey = new Map<string, { id: string; quantity: number }>();
        for (const row of existingRows) {
            if (!row.ingredient_id) continue;
            const qty = parseFloat(String(row.quantity ?? 0)) || 0;
            byKey.set(keyOf(row.ingredient_id, row.unit_id), { id: row.id, quantity: qty });
        }

        // Batch-load each ingredient's default shopping category so new items
        // land in Produce / Dairy / etc. instead of all collapsing to "other".
        const ingredientIdsForLookup = Array.from(
            new Set(
                ingredients
                    .map((i) => i.ingredientId)
                    .filter((id): id is string => Boolean(id)),
            ),
        );
        const categoryByIngredient = new Map<string, string>();
        if (ingredientIdsForLookup.length > 0) {
            const { data: ingRows, error: ingErr } = await supabase
                .from('ingredients')
                .select('id, default_category_id')
                .in('id', ingredientIdsForLookup);
            if (ingErr) throw new Error(`Load ingredient categories failed: ${ingErr.message}`);
            for (const row of ingRows ?? []) {
                if (row.default_category_id) {
                    categoryByIngredient.set(row.id as string, row.default_category_id as string);
                }
            }
        }

        const toInsert: Record<string, any>[] = [];
        const toUpdate = new Map<string, number>();
        for (const ing of ingredients) {
            const ingId = ing.ingredientId ?? null;
            const unitId = ing.unitId ?? null;
            if (ingId) {
                const match = byKey.get(keyOf(ingId, unitId));
                if (match) {
                    match.quantity += ing.quantity;
                    toUpdate.set(match.id, match.quantity);
                    continue;
                }
            }
            const resolvedCategory =
                ing.categoryId ?? (ingId ? categoryByIngredient.get(ingId) : undefined) ?? 'other';
            toInsert.push({
                shopping_list_id: listId,
                ingredient_id: ingId,
                name_custom: ingId ? null : ing.name ?? null,
                category_id: resolvedCategory,
                quantity: ing.quantity,
                unit_id: unitId,
                recipe_id: ing.recipeId ?? null,
                is_checked: false,
            });
        }

        if (toInsert.length > 0) {
            const { error } = await supabase.from('shopping_list_items').insert(toInsert);
            if (error) throw new Error(`Insert items failed: ${error.message}`);
        }
        if (toUpdate.size > 0) {
            const results = await Promise.all(
                [...toUpdate.entries()].map(([id, quantity]) =>
                    supabase.from('shopping_list_items').update({ quantity }).eq('id', id),
                ),
            );
            const failed = results.find((r) => r.error);
            if (failed?.error) throw new Error(`Update quantity failed: ${failed.error.message}`);
        }

        const userId = await getCurrentUserId();
        await invalidateShoppingCaches(userId, listId);
    },
};

export default shoppingListService;

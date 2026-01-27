import { BaseCache, CacheConfig } from './baseCache';
import { ShoppingListWithItems, ShoppingList, ShoppingCategory } from '@/types/shopping-list.types';

// Cache config: 30 minutes for lists, 7 days for categories (static)
const SHOPPING_LIST_CACHE_CONFIG: CacheConfig = {
    memoryCacheExpiry: 5 * 60 * 1000, // 5 minutes in memory
    storageCacheExpiry: 30 * 60 * 1000, // 30 minutes in storage
    maxMemoryCacheItems: 10,
};

const CATEGORY_CACHE_CONFIG: CacheConfig = {
    memoryCacheExpiry: 60 * 60 * 1000, // 1 hour in memory
    storageCacheExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days in storage
    maxMemoryCacheItems: 1,
};

const LISTS_SUMMARY_CACHE_CONFIG: CacheConfig = {
    memoryCacheExpiry: 2 * 60 * 1000, // 2 minutes in memory
    storageCacheExpiry: 30 * 60 * 1000, // 30 minutes in storage
    maxMemoryCacheItems: 1,
};

// Cache for individual shopping lists with items
class ShoppingListDetailCache extends BaseCache<ShoppingListWithItems> {
    constructor() {
        super('shopping_list_detail', SHOPPING_LIST_CACHE_CONFIG);
    }

    async getList(listId: string): Promise<ShoppingListWithItems | undefined> {
        return this.getItem(listId);
    }

    async setList(listId: string, list: ShoppingListWithItems): Promise<void> {
        return this.setItem(listId, list);
    }

    async invalidateList(listId: string): Promise<void> {
        return this.invalidateItem(listId);
    }
}

// Cache for shopping list summaries (index page)
class ShoppingListsSummaryCache extends BaseCache<ShoppingList[]> {
    constructor() {
        super('shopping_lists_summary', LISTS_SUMMARY_CACHE_CONFIG);
    }

    async getLists(includeArchived: boolean = false): Promise<ShoppingList[] | undefined> {
        const key = includeArchived ? 'all' : 'active';
        return this.getItem(key);
    }

    async setLists(lists: ShoppingList[], includeArchived: boolean = false): Promise<void> {
        const key = includeArchived ? 'all' : 'active';
        return this.setItem(key, lists);
    }

    async invalidateLists(): Promise<void> {
        await this.invalidateItem('all');
        await this.invalidateItem('active');
    }
}

// Cache for shopping categories (static data)
class ShoppingCategoryCache extends BaseCache<ShoppingCategory[]> {
    constructor() {
        super('shopping_categories', CATEGORY_CACHE_CONFIG);
    }

    async getCategories(): Promise<ShoppingCategory[] | undefined> {
        return this.getItem('all');
    }

    async setCategories(categories: ShoppingCategory[]): Promise<void> {
        return this.setItem('all', categories);
    }
}

// Export singleton instances
export const shoppingListDetailCache = new ShoppingListDetailCache();
export const shoppingListsSummaryCache = new ShoppingListsSummaryCache();
export const shoppingCategoryCache = new ShoppingCategoryCache();

// Helper to invalidate all shopping list related caches
export async function invalidateAllShoppingListCaches(): Promise<void> {
    await Promise.all([
        shoppingListDetailCache.clearCache(),
        shoppingListsSummaryCache.clearCache(),
    ]);
}

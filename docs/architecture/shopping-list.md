# Shopping List Architecture

## Status

- **Branch**: `feature/shopping-list` (awaiting merge to main)
- **Backend**: No edge functions — all operations use direct Supabase client queries
- **Migrations**: `011_add_shopping_list.sql`, `012_add_update_item_order_rpc.sql`

## Feature Overview

| Capability | Description |
|---|---|
| Multiple lists | Named lists, archivable |
| Items | From ingredient database or custom text entry |
| 12 auto-categories | Collapsible sections (Produce, Dairy, Meat, Bakery, Pantry Staples, Frozen, Beverages, Snacks, Spices & Condiments, Household, Personal Care, Other) |
| Check/uncheck | With progress bar and percentage |
| Multi-select | Batch check, uncheck, and delete operations |
| Drag-and-drop | Reorder items within categories |
| Smart consolidation | Merge duplicate ingredients (same ingredient + same unit) |
| Offline-first | Mutation queue with auto-sync on reconnect |
| Undo | 5-second toast with undo for deletions |
| Pantry | Track what you already have at home |
| Favorites / Buy Again | Quick-add frequently purchased items |
| Purchase history | Foundation for future AI-powered recommendations |

## Architecture Overview

```
Screens (app/(tabs)/shopping/)
    ↓
Hooks (useShoppingListData, useSelectionMode, useBatchActions, useOfflineSync)
    ↓
Service (shoppingListService, pantryService)
    ↓                        ↓
Supabase Client       OfflineQueue (mutationQueue)
    ↓                        ↓
Cache Layer           AsyncStorage (persisted queue)
```

Data flows top-down. Screens compose hooks, hooks call the service layer, and the service reads/writes through Supabase with a three-tier cache. When offline, mutations are queued in AsyncStorage and replayed on reconnect.

## Database Schema

Seven tables, all with RLS enabled.

### `shopping_list_categories`

Seed data — 12 categories with bilingual names and Ionicons icon identifiers.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` PK | e.g. `produce`, `dairy`, `other` |
| `name_en` | `TEXT` | English name |
| `name_es` | `TEXT` | Spanish name |
| `icon` | `TEXT` | Ionicons name (e.g. `leaf-outline`) |
| `display_order` | `INTEGER` | Default sort order (1–12) |
| `created_at` | `TIMESTAMPTZ` | |

**RLS**: SELECT for everyone (public reference data).

### `shopping_lists`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | Auto-generated |
| `user_id` | `UUID` FK → `user_profiles` | CASCADE delete |
| `name` | `TEXT` | |
| `is_archived` | `BOOLEAN` | Default `false` |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated by trigger |

**RLS**: Users can manage (ALL) their own lists.

### `shopping_list_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `shopping_list_id` | `UUID` FK → `shopping_lists` | CASCADE delete |
| `ingredient_id` | `UUID` FK → `ingredients` | SET NULL on delete |
| `category_id` | `TEXT` FK → `shopping_list_categories` | Default `'other'` |
| `name_custom` | `TEXT` | Used when `ingredient_id` is null |
| `quantity` | `NUMERIC(10,2)` | Default 1 |
| `unit_id` | `TEXT` FK → `measurement_units` | |
| `notes` | `TEXT` | |
| `is_checked` | `BOOLEAN` | Default `false` |
| `checked_at` | `TIMESTAMPTZ` | Set by trigger on check |
| `recipe_id` | `UUID` FK → `recipes` | SET NULL — tracks source recipe |
| `display_order` | `INTEGER` | For drag-and-drop ordering |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

**Constraint**: `item_has_name` — `CHECK (ingredient_id IS NOT NULL OR name_custom IS NOT NULL)`

**RLS**: Users can manage items in their own lists (EXISTS subquery on `shopping_lists.user_id`).

### `user_category_order`

Custom per-user category sort order.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `UUID` FK → `user_profiles` | Composite PK |
| `category_id` | `TEXT` FK → `shopping_list_categories` | Composite PK |
| `display_order` | `INTEGER` | |

### `pantry_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `user_id` | `UUID` FK → `user_profiles` | CASCADE delete |
| `ingredient_id` | `UUID` FK → `ingredients` | SET NULL |
| `category_id` | `TEXT` FK → `shopping_list_categories` | |
| `name_custom` | `TEXT` | |
| `quantity` | `NUMERIC(10,2)` | |
| `unit_id` | `TEXT` FK → `measurement_units` | |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |

### `favorite_shopping_items`

"Buy Again" items with purchase frequency tracking.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `user_id` | `UUID` FK → `user_profiles` | CASCADE delete |
| `ingredient_id` | `UUID` FK → `ingredients` | SET NULL |
| `category_id` | `TEXT` FK → `shopping_list_categories` | |
| `name_custom` | `TEXT` | |
| `default_quantity` | `NUMERIC(10,2)` | |
| `default_unit_id` | `TEXT` FK → `measurement_units` | |
| `purchase_count` | `INTEGER` | Incremented on each purchase |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |

### `purchase_history`

Insert-only log for AI recommendation training.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `user_id` | `UUID` FK → `user_profiles` | CASCADE delete |
| `ingredient_id` | `UUID` FK → `ingredients` | SET NULL |
| `category_id` | `TEXT` FK → `shopping_list_categories` | |
| `name_custom` | `TEXT` | |
| `quantity` | `NUMERIC(10,2)` | |
| `unit_id` | `TEXT` FK → `measurement_units` | |
| `purchased_at` | `TIMESTAMPTZ` | |
| `recipe_id` | `UUID` FK → `recipes` | SET NULL |
| `shopping_list_id` | `UUID` FK → `shopping_lists` | SET NULL |

**RLS**: SELECT + INSERT only (no updates or deletes).

### Indexes

| Index | Table | Column(s) |
|---|---|---|
| `idx_shopping_lists_user` | `shopping_lists` | `user_id` |
| `idx_shopping_list_items_list` | `shopping_list_items` | `shopping_list_id` |
| `idx_shopping_list_items_ingredient` | `shopping_list_items` | `ingredient_id` |
| `idx_pantry_user` | `pantry_items` | `user_id` |
| `idx_favorites_user` | `favorite_shopping_items` | `user_id` |
| `idx_purchase_history_user` | `purchase_history` | `user_id` |

### Triggers

- **`update_modified_column()`** — sets `updated_at = NOW()` on UPDATE. Applied to: `shopping_lists`, `shopping_list_items`, `pantry_items`, `favorite_shopping_items`.
- **`record_purchase_on_check()`** — sets `checked_at = NOW()` when `is_checked` changes from false to true. Applied to: `shopping_list_items`.

### RPC: `update_shopping_list_item_orders`

Batch updates item `display_order` via a single round-trip. Uses `SECURITY INVOKER` so RLS is enforced — the function verifies the user owns the shopping list.

```sql
CREATE OR REPLACE FUNCTION update_shopping_list_item_orders(updates jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE shopping_list_items AS sli
  SET display_order = u.display_order
  FROM jsonb_to_recordset(updates) AS u(id uuid, display_order integer)
  WHERE sli.id = u.id
    AND sli.shopping_list_id IN (
      SELECT id FROM shopping_lists WHERE user_id = auth.uid()
    );
$$;
```

Input: `[{ "id": "<uuid>", "display_order": 1 }, ...]`

## Frontend Architecture

### Types (`types/shopping-list.types.ts`)

Key interfaces:

- `ShoppingList` / `ShoppingListWithItems` — list summary and full detail with items + categories
- `ShoppingListItem` — item with resolved ingredient name, unit, check state, display order
- `ShoppingListItemCreate` / `ShoppingListItemUpdate` — write DTOs
- `ShoppingCategory` / `ShoppingCategoryWithItems` — category with localized name and nested items
- `PantryItem`, `FavoriteShoppingItem`, `IngredientSuggestion`, `ConsolidationResult`
- `CATEGORY_ICONS` — `Record<string, string>` mapping category IDs to Ionicons names

### Service Layer (`services/shoppingListService.ts`)

459 lines. All 15 methods:

| Method | Description |
|---|---|
| `getShoppingLists(includeArchived?)` | List summaries with item counts |
| `getShoppingListById(id, useCache?)` | Full list with items + categories |
| `createShoppingList(name)` | Create a new list |
| `deleteShoppingList(id)` | Delete list + cascade items |
| `addItem(item)` | Add item, auto-calculates `display_order` |
| `updateItem(itemId, updates, listId?)` | Partial update |
| `toggleItemChecked(itemId, isChecked, listId?)` | Convenience wrapper for check/uncheck |
| `deleteItem(itemId, listId?)` | Delete single item |
| `consolidateItems(shoppingListId)` | Merge duplicates (same ingredient + unit) |
| `getCategories(useCache?)` | Categories with user custom order applied |
| `searchIngredients(query, limit?)` | Search ingredient DB (ILIKE, sanitized) |
| `updateItemsOrder(updates, listId?)` | Batch reorder via RPC |
| `batchDeleteItems(itemIds, listId?)` | Batch delete |
| `batchUpdateItems(itemIds, updates, listId?)` | Batch check/uncheck |

Each write method invalidates the relevant caches after mutation. The service uses shared mappers (`mapIngredient`, `mapMeasurementUnit` from `services/utils/mapSupabaseItem.ts`) to avoid `as any` casts when transforming Supabase join results.

### Cache Layer (`services/cache/shoppingListCache.ts`)

Three singleton caches extending `BaseCache`, each with memory + storage tiers:

| Cache | Memory TTL | Storage TTL | Purpose |
|---|---|---|---|
| `shoppingListDetailCache` | 5 min | 30 min | Individual list with items |
| `shoppingListsSummaryCache` | 2 min | 30 min | Index page list summaries |
| `shoppingCategoryCache` | 1 hour | 7 days | Category reference data |

Cache keys are namespaced by userId. The `invalidateShoppingCaches` helper clears both detail and summary caches after any mutation.

### Offline Queue (`services/offlineQueue/mutationQueue.ts`)

A singleton `MutationQueue` class that persists pending mutations to AsyncStorage.

**7 mutation types** with strongly-typed payloads:

| Type | Payload |
|---|---|
| `ADD_ITEM` | `{ item: ShoppingListItemCreate; listId?: string }` |
| `UPDATE_ITEM` | `{ itemId: string; updates: ShoppingListItemUpdate; listId?: string }` |
| `DELETE_ITEM` | `{ itemId: string; listId?: string }` |
| `CHECK_ITEM` | `{ itemId: string; isChecked: boolean; listId?: string }` |
| `BATCH_CHECK` | `{ itemIds: string[]; isChecked: boolean; listId?: string }` |
| `BATCH_DELETE` | `{ itemIds: string[]; listId?: string }` |
| `REORDER_ITEMS` | `{ updates: Array<{ id: string; displayOrder: number }>; listId?: string }` |

Key behaviors:
- **Namespace isolation**: storage key includes userId to prevent cross-account leakage
- **FIFO processing**: mutations are replayed in order
- **3-retry policy**: fails permanently after 3 attempts, then the mutation is dropped
- **Concurrency guard**: `isProcessing` flag prevents parallel queue processing

### Hooks

#### `useShoppingListData` — Main Orchestrator

The central hook for the list detail screen. Composes `useOfflineSync` and `useUndoableDelete` internally.

**Returns**: list data, categories, loading/refreshing state, search filtering, category collapse state, progress percentage, CRUD handlers (check, delete, add, consolidate, reorder), offline state, and a `setList` setter for optimistic updates from sibling hooks.

Key patterns:
- **Optimistic UI** on check, delete, add, and reorder — updates local state immediately, rolls back on error
- **Temporary IDs** for optimistic add: creates `temp-<uuid>` items, replaces with real ID after server response
- **Collapsed categories** persisted per-list in AsyncStorage
- **Search** filters items by name and notes (client-side)

#### `useOfflineSync` — Queue + Auto-Sync

Wraps `useNetworkStatus` and `mutationQueue`.

- Initializes queue namespace from auth user ID, re-syncs on auth state changes
- Tracks `wasOfflineRef` to detect offline → online transitions
- Auto-syncs on reconnect when `autoSync = true` (default)
- Validates payload structure before executing each mutation
- Reports sync results via toast (success, partial, error)

#### `useSelectionMode` — Multi-Select

Manages a `Set<string>` of selected item IDs.

- Persists selection state to AsyncStorage (survives navigation)
- Validates persisted IDs against current items on restore (removes stale selections)
- Provides select-all, deselect-all, and toggle-all-in-category
- Haptic feedback on bulk selection actions

#### `useBatchActions` — Batch Operations

Orchestrates batch check/uncheck/delete with optimistic UI.

- Composes `useUndoableDelete` for batch delete with undo
- Unified `handleBatchToggle` for check/uncheck (DRY)
- Confirmation modals for destructive actions (delete, clear checked)
- Falls back to offline queue when disconnected
- Tracks loading states per operation type

#### `useUndoableDelete` — Undo Support

Generic hook (not shopping-list-specific) for deferred deletions.

- Shows a custom `undo` toast (5s default) with countdown
- Commits the actual API delete only after timeout expires
- Cancels and restores on undo press with haptic feedback
- Commits all pending deletions on component unmount
- Used by both single-item delete and batch delete flows

#### `useNetworkStatus` — Connectivity

Thin wrapper around `@react-native-community/netinfo`. Returns `{ isConnected, isInternetReachable, type }`.

### Components (`components/shopping-list/`)

| Component | Description |
|---|---|
| `ShoppingListCard` | List summary card for the index screen. Shows name, progress bar, item count. `React.memo`. |
| `ShoppingListItemRow` | Single item with checkbox, ingredient image, quantity, swipe-to-delete (PanResponder). `React.memo`. |
| `DraggableShoppingListItem` | Wraps `ShoppingListItemRow` with a drag handle for `react-native-draggable-flatlist`. Haptic on drag start. Hidden in select mode. `React.memo`. |
| `CategorySection` | Collapsible group with category icon/name header, item count badge, and select-all-in-category toggle. Uses `DraggableFlatList` for unchecked items, standard list for checked items. `React.memo`. |
| `AddItemModal` | Modal with ingredient search (debounced), custom item entry, category picker, quantity input, and notes field. |
| `FloatingActionBar` | Bottom action bar shown in selection mode. Buttons: select all / deselect all, check, uncheck, delete. Shows loading indicators per action. |

Shared component:
- `OfflineBanner` (`components/common/OfflineBanner.tsx`) — Animated slide-in banner showing offline status or sync progress. Pulse animation while syncing.

### Screens (`app/(tabs)/shopping/`)

| Screen | Route | Description |
|---|---|---|
| `_layout.tsx` | — | Stack navigator with app-standard header styling |
| `index.tsx` | `/(tabs)/shopping` | List of shopping lists with create modal (FAB) and pull-to-refresh |
| `[id].tsx` | `/(tabs)/shopping/[id]` | List detail: search bar, category sections, progress bar, add item FAB, selection mode with `FloatingActionBar`, `OfflineBanner`, skeleton loader |
| `favorites.tsx` | `/(tabs)/shopping/favorites` | Buy Again screen — lists favorite items from `pantryService` |
| `pantry.tsx` | `/(tabs)/shopping/pantry` | Pantry management — items grouped by category from `pantryService` |

## Offline Sync Deep-Dive

This is the most complex subsystem. Breaking it here avoids breaking it later.

### Flow: Online

```
User action → Optimistic UI update → Service call → Cache invalidation → Done
                                         ↓ (on error)
                                    Rollback UI state
```

### Flow: Offline

```
User action → Optimistic UI update → mutationQueue.enqueue() → AsyncStorage persist → Done
```

### Flow: Reconnect

```
NetInfo detects connectivity → useOfflineSync triggers syncNow()
    → mutationQueue.processAll(executor)
        → For each mutation (FIFO):
            1. Validate payload structure
            2. Call shoppingListService method
            3. On success: dequeue from AsyncStorage
            4. On failure: increment retryCount
               - retryCount >= 2 → drop mutation (3 attempts total)
               - retryCount < 2  → keep for next sync
    → Show toast (success / partial / error)
    → Call onSyncComplete → fetchList(forceRefresh: true)
```

### Why 3 retries then drop?

A mutation that fails 3 times likely refers to a deleted resource (item, list) or has a structural issue. Blocking the queue permanently would prevent all subsequent mutations from processing.

### Namespace isolation

The queue storage key is `shopping_list_mutation_queue:<userId>`. When the user logs out and another logs in, `setNamespace()` resets the in-memory queue and reloads from the new user's key. This prevents User A's offline mutations from being replayed under User B's auth.

## Recipe Integration

- `shopping_list_items.recipe_id` tracks which recipe an item came from (SET NULL on recipe delete)
- `purchase_history.recipe_id` records recipe context for purchased items
- Future: "Add all ingredients to shopping list" button on recipe detail (schema supports it, UI not built)

## Testing

15 test files covering components, hooks, and services:

### Component Tests (7)
- `components/shopping-list/__tests__/AddItemModal.test.tsx`
- `components/shopping-list/__tests__/CategorySection.test.tsx`
- `components/shopping-list/__tests__/DraggableShoppingListItem.test.tsx`
- `components/shopping-list/__tests__/FloatingActionBar.test.tsx`
- `components/shopping-list/__tests__/ShoppingListCard.test.tsx`
- `components/shopping-list/__tests__/ShoppingListItemRow.test.tsx`
- `components/common/__tests__/OfflineBanner.test.tsx`

### Hook Tests (5)
- `hooks/__tests__/useBatchActions.test.ts`
- `hooks/__tests__/useOfflineSync.test.ts`
- `hooks/__tests__/useSelectionMode.test.ts`
- `hooks/__tests__/useShoppingListData.test.ts`
- `hooks/__tests__/useUndoableDelete.test.ts`

### Service Tests (3)
- `services/__tests__/shoppingListService.test.ts`
- `services/__tests__/pantryService.test.ts`
- `services/offlineQueue/__tests__/mutationQueue.test.ts`

### Test Factory
- `test/factories/shopping-list.factory.ts` — factory functions for creating test fixtures

### Testing Patterns

- **Mock the service**: Component and hook tests mock `shoppingListService` and `pantryService` entirely. Avoid hitting Supabase.
- **Offline state**: Mock `useNetworkStatus` to return `{ isConnected: false }` for offline scenarios.
- **Batch operations**: Test optimistic UI updates + rollback on error separately from the actual API calls.
- **Undo flows**: Use `jest.advanceTimersByTime(5000)` with fake timers to test undo timeout behavior.

## Known Limitations & Future Work

- **No real-time collaboration** — lists are single-user only. No Supabase Realtime subscriptions.
- **No "Add recipe ingredients to list" UI** — the schema supports `recipe_id` on items, but the recipe detail screen doesn't have an "add to shopping list" button yet.
- **Purchase history is insert-only** — no cleanup or retention policy. Will grow unbounded over time.
- **Profile route mismatch** — the user profile feature buttons link to `/(tabs)/profile/shopping` but the actual route is `/(tabs)/shopping`. This needs to be fixed when the tab navigation is finalized.

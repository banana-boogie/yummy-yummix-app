# Shopping List Feature

## 1. Feature Overview

The shopping list is an offline-first, category-organized grocery management system. Users create lists, add items (from an ingredient database or custom text), organize by store aisle, and check items off as they shop.

### Capabilities

| Capability | Description |
|---|---|
| **List management** | Create, rename, archive shopping lists |
| **Item management** | Add items by ingredient search or custom name, set quantity and unit |
| **Check/uncheck** | Tap to mark items as purchased with optimistic UI |
| **Batch operations** | Multi-select mode to check, uncheck, or delete many items at once |
| **Drag-to-reorder** | Long-press and drag unchecked items within a category |
| **Swipe-to-delete** | Swipe left on an item to delete, with undo toast |
| **Search & filter** | Search items by name or notes within a list |
| **Progress tracking** | Progress bar showing checked / total items |
| **Category grouping** | Items grouped by grocery aisle (Produce, Dairy, Meat, etc.) with collapsible sections |
| **Duplicate consolidation** | Merge duplicate ingredients into a single row |
| **Offline support** | Mutation queue persisted to AsyncStorage, synced when online |
| **Pantry** | Track items you have on hand, grouped by category |
| **Favorites (Buy Again)** | Save frequently purchased items with purchase count |

### User Flow

```
Create list  ──>  Add items (search or custom)  ──>  Shop & check off  ──>  Clear checked
                                                          │
                                          Batch select  ──┘
```

---

## 2. Architecture Overview

### Layer Diagram

```
┌────────────────────────────────────────────────────────┐
│  Screens (Expo Router)                                 │
│  app/(tabs)/shopping/{index,[id],pantry,favorites}     │
├────────────────────────────────────────────────────────┤
│  Components                                            │
│  components/shopping-list/*                            │
├────────────────────────────────────────────────────────┤
│  Hooks                                                 │
│  useShoppingListData, useSelectionMode,                │
│  useBatchActions, useOfflineSync, useUndoableDelete    │
├────────────────────────────────────────────────────────┤
│  Services                                              │
│  shoppingListService, pantryService                    │
├────────────────────────────────────────────────────────┤
│  Offline Queue                                         │
│  services/offlineQueue/mutationQueue.ts                │
├────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL + RLS + RPC)                     │
│  Tables, policies, triggers, functions                 │
└────────────────────────────────────────────────────────┘
```

### File Map

```
yyx-app/
├── app/(tabs)/shopping/
│   ├── _layout.tsx               # Stack navigator with shared header styling
│   ├── index.tsx                 # Lists overview, create modal
│   ├── [id].tsx                  # List detail (main shopping screen)
│   ├── pantry.tsx                # Pantry items grouped by category
│   └── favorites.tsx             # Buy Again favorites
│
├── components/shopping-list/
│   ├── index.ts                  # Barrel exports
│   ├── CategorySection.tsx       # Collapsible category with draggable items
│   ├── ShoppingListItem.tsx      # Item row with swipe-to-delete
│   ├── DraggableShoppingListItem.tsx  # Drag handle wrapper
│   ├── AddItemModal.tsx          # Ingredient search + quantity picker
│   ├── FloatingActionBar.tsx     # Batch action toolbar
│   └── ShoppingListCard.tsx      # List preview card
│
├── components/common/
│   └── OfflineBanner.tsx         # Offline/sync status banner
│
├── hooks/
│   ├── useShoppingListData.ts    # Core data: fetch, CRUD, search, reorder
│   ├── useSelectionMode.ts       # Multi-select state
│   ├── useBatchActions.ts        # Batch check/uncheck/delete
│   ├── useOfflineSync.ts         # Network detection + mutation queue
│   └── useUndoableDelete.ts      # Soft delete with undo timer
│
├── services/
│   ├── shoppingListService.ts    # Supabase queries for lists + items
│   ├── pantryService.ts          # Pantry + favorites CRUD
│   └── offlineQueue/
│       └── mutationQueue.ts      # Persistent FIFO mutation queue
│
├── types/
│   └── shopping-list.types.ts    # All TypeScript interfaces
│
└── i18n/locales/{en,es}/
    └── shoppingList.ts           # Translation keys
```

### Data Flow

```
User action
  └─> Optimistic update (LayoutAnimation + state)
        └─> Online? ─── Yes ──> Service call ──> Supabase
            │                         │
            No                    Error? ──> Rollback state
            │
            └─> Queue mutation (AsyncStorage)
                  └─> Sync when online
```

---

## 3. Database Schema

**Migration files:**
- `yyx-server/db/migrations/011_add_shopping_list.sql`
- `yyx-server/db/migrations/012_add_update_item_order_rpc.sql`

### Tables

#### `shopping_list_categories`
Reference table, seeded with 12 categories.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` PK | e.g. `produce`, `dairy`, `other` |
| `name_en` | `TEXT NOT NULL` | English name |
| `name_es` | `TEXT NOT NULL` | Spanish name |
| `icon` | `TEXT NOT NULL` | Ionicons name |
| `display_order` | `INTEGER NOT NULL` | Sort order |

**Seeded categories:** produce, dairy, meat, bakery, pantry, frozen, beverages, snacks, spices, household, personal, other

#### `shopping_lists`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | `uuid_generate_v4()` |
| `user_id` | `UUID NOT NULL` | FK → `user_profiles(id)` ON DELETE CASCADE |
| `name` | `TEXT NOT NULL` | |
| `is_archived` | `BOOLEAN` | Default `FALSE` |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated via trigger |

#### `shopping_list_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `shopping_list_id` | `UUID NOT NULL` | FK → `shopping_lists(id)` ON DELETE CASCADE |
| `ingredient_id` | `UUID` | FK → `ingredients(id)` ON DELETE SET NULL |
| `category_id` | `TEXT NOT NULL` | FK → `shopping_list_categories(id)`, default `'other'` |
| `name_custom` | `TEXT` | Used when `ingredient_id` is null |
| `quantity` | `NUMERIC(10,2)` | Default `1` |
| `unit_id` | `TEXT` | FK → `measurement_units(id)` |
| `notes` | `TEXT` | |
| `is_checked` | `BOOLEAN` | Default `FALSE` |
| `checked_at` | `TIMESTAMPTZ` | Set by trigger when checked |
| `recipe_id` | `UUID` | FK → `recipes(id)` ON DELETE SET NULL |
| `display_order` | `INTEGER` | Default `0` |

**Constraint:** `item_has_name` — either `ingredient_id` or `name_custom` must be set.

#### `pantry_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `user_id` | `UUID NOT NULL` | FK → `user_profiles(id)` |
| `ingredient_id` | `UUID` | FK → `ingredients(id)` |
| `category_id` | `TEXT NOT NULL` | FK → `shopping_list_categories(id)` |
| `name_custom` | `TEXT` | |
| `quantity` | `NUMERIC(10,2)` | Default `1` |
| `unit_id` | `TEXT` | FK → `measurement_units(id)` |

#### `favorite_shopping_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `user_id` | `UUID NOT NULL` | FK → `user_profiles(id)` |
| `ingredient_id` | `UUID` | FK → `ingredients(id)` |
| `category_id` | `TEXT NOT NULL` | FK → `shopping_list_categories(id)` |
| `name_custom` | `TEXT` | |
| `default_quantity` | `NUMERIC(10,2)` | Default `1` |
| `default_unit_id` | `TEXT` | FK → `measurement_units(id)` |
| `purchase_count` | `INTEGER` | Default `1` |

#### `purchase_history`
Logs checked-off items for future AI recommendations.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `user_id` | `UUID NOT NULL` | |
| `ingredient_id` | `UUID` | |
| `category_id` | `TEXT NOT NULL` | |
| `name_custom` | `TEXT` | |
| `quantity` | `NUMERIC(10,2)` | |
| `unit_id` | `TEXT` | |
| `purchased_at` | `TIMESTAMPTZ` | |
| `recipe_id` | `UUID` | Source recipe |
| `shopping_list_id` | `UUID` | Source list |

#### `user_category_order`
Custom per-user category sort order.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `UUID` | Composite PK with `category_id` |
| `category_id` | `TEXT` | Composite PK |
| `display_order` | `INTEGER NOT NULL` | |

### RLS Policies

All tables have RLS enabled. Every policy is scoped to `auth.uid()`:

| Table | Policy | Access |
|---|---|---|
| `shopping_list_categories` | Viewable by everyone | `SELECT` with `USING (true)` |
| `shopping_lists` | Users manage their own | `ALL` where `user_id = auth.uid()` |
| `shopping_list_items` | Users manage their own | `ALL` via subquery checking parent list's `user_id` |
| `pantry_items` | Users manage their own | `ALL` where `user_id = auth.uid()` |
| `favorite_shopping_items` | Users manage their own | `ALL` where `user_id = auth.uid()` |
| `purchase_history` | View + insert own | Separate `SELECT`/`INSERT` policies |
| `user_category_order` | Users manage their own | `ALL` where `user_id = auth.uid()` |

### RPC Function

```sql
CREATE OR REPLACE FUNCTION update_shopping_list_item_orders(updates jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER  -- respects RLS
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

### Triggers

- **`update_modified_column()`** — Auto-sets `updated_at = NOW()` on UPDATE for `shopping_lists`, `shopping_list_items`, `pantry_items`, `favorite_shopping_items`.
- **`record_purchase_on_check()`** — Sets `checked_at = NOW()` when an item is checked (`is_checked` goes from `FALSE` to `TRUE`).

### Indexes

```
idx_shopping_lists_user           ON shopping_lists(user_id)
idx_shopping_list_items_list      ON shopping_list_items(shopping_list_id)
idx_shopping_list_items_ingredient ON shopping_list_items(ingredient_id)
idx_pantry_user                   ON pantry_items(user_id)
idx_favorites_user                ON favorite_shopping_items(user_id)
idx_purchase_history_user         ON purchase_history(user_id)
```

---

## 4. Screens

### `_layout.tsx` — Stack Navigator
**Path:** `app/(tabs)/shopping/_layout.tsx`

Configures an Expo Router `Stack` with consistent header styling (Quicksand-Bold font, cream background). Registers four screens: `index`, `[id]`, `pantry`, `favorites`. Re-renders on language change via `useLanguage()`.

### `index.tsx` — Lists Overview
**Path:** `app/(tabs)/shopping/index.tsx`

Displays all shopping lists with `FlatList`. Each row is a `ShoppingListCard` showing name, progress bar, and item counts. A FAB opens a modal to create a new list. Supports pull-to-refresh.

**Key state:** `lists`, `createModalVisible`, `newListName`

### `[id].tsx` — List Detail (Main Screen)
**Path:** `app/(tabs)/shopping/[id].tsx`

The primary shopping interface. This is where users spend most of their time.

**Features:**
- Items organized by `CategorySection` components
- Search bar with 200ms debounce
- Animated progress bar (`checked / total`)
- Selection mode via header button, with `FloatingActionBar` for batch operations
- Consolidate duplicates and clear checked via header menu
- `AddItemModal` triggered by FAB
- Skeleton loader on initial fetch
- Empty state when all items are checked
- Pull-to-refresh

**Hooks used:** `useShoppingListData`, `useSelectionMode`, `useBatchActions`

### `pantry.tsx` — Pantry
**Path:** `app/(tabs)/shopping/pantry.tsx`

Displays pantry items grouped by category with localized names. Pull-to-refresh. Empty state when no pantry items exist.

### `favorites.tsx` — Buy Again
**Path:** `app/(tabs)/shopping/favorites.tsx`

Shows frequently purchased items with purchase counts. Simple list with empty state.

---

## 5. Hook Architecture

### Composition Diagram

```
[id].tsx (detail screen)
  ├── useShoppingListData ─────── Main orchestrator
  │     ├── useOfflineSync ────── Network + mutation queue
  │     │     └── mutationQueue   Persistent FIFO queue
  │     └── useUndoableDelete ─── Undo toasts
  │
  ├── useSelectionMode ────────── Independent, multi-select state
  │
  └── useBatchActions ─────────── Receives state from the above two
        └── useUndoableDelete ─── Undo for batch deletes
```

### `useShoppingListData`
**File:** `hooks/useShoppingListData.ts`

Central hook for the list detail screen. Manages:

| Responsibility | Details |
|---|---|
| **Fetching** | Loads list + items from service, with loading/error states |
| **Item CRUD** | `handleAddItem`, `handleCheckItem`, `handleDeleteItem` — all with optimistic updates |
| **Search** | `searchQuery` state, memoized `filteredCategories` |
| **Category collapse** | `collapsedCategories` Set, persisted to AsyncStorage (`collapsed_categories_{listId}`) |
| **Reorder** | `handleReorderItems` with RPC call and haptic feedback |
| **Consolidation** | `handleConsolidate` merges duplicate ingredients |
| **Progress** | Memoized `progressPercentage` |
| **Refresh** | `handleRefresh` for pull-to-refresh |

**Depends on:** `useOfflineSync`, `useUndoableDelete`, `useToast`

### `useSelectionMode`
**File:** `hooks/useSelectionMode.ts`

Manages multi-select state independently from data:

- `isSelectMode` / `toggleSelectMode()`
- `selectedItems` Set + `toggleItemSelection(itemId)`
- `handleSelectAll()` / `handleDeselectAll()`
- `handleSelectAllInCategory(itemIds)`
- `selectedItemsInfo` — computed `{ items, hasChecked, hasUnchecked }`
- Selection state persisted to AsyncStorage (`selection_state_{listId}`)
- Haptic feedback on select/deselect actions

### `useBatchActions`
**File:** `hooks/useBatchActions.ts`

Takes list state and selection state as parameters. Provides:

- `handleBatchCheck()` / `handleBatchUncheck()` — optimistic toggle with rollback
- `handleBatchDeleteRequest()` / `handleBatchDeleteConfirm()` — confirmation modal + undo
- `handleClearCheckedRequest()` / `handleClearCheckedConfirm()` — remove all checked items
- Loading states: `isBatchChecking`, `isBatchDeleting`, `isClearingChecked`, etc.

All batch operations support offline queueing and undo via `useUndoableDelete`.

### `useOfflineSync`
**File:** `hooks/useOfflineSync.ts`

Network detection and mutation queue management:

- `isOffline` — derived from `@react-native-community/netinfo`
- `queueMutation(type, payload)` — enqueues a mutation for later sync
- `syncNow()` — manually trigger sync
- `pendingCount` / `isSyncing` — UI state for `OfflineBanner`
- Auto-sync on reconnect (if enabled)
- Namespace isolation per user ID (`mutationQueue.setNamespace(userId)`)

**Mutation types:** `ADD_ITEM`, `UPDATE_ITEM`, `DELETE_ITEM`, `CHECK_ITEM`, `BATCH_CHECK`, `BATCH_DELETE`, `REORDER_ITEMS`

### `useUndoableDelete`
**File:** `hooks/useUndoableDelete.ts`

Generic hook (`useUndoableDelete<T>`) for soft-delete with undo:

1. Item removed from UI immediately
2. Toast shown with "Undo" button for N seconds
3. If undo tapped → item restored, `onRestore` called
4. If timer expires → `onConfirm` called to persist deletion
5. If `onConfirm` fails → `onError` called for recovery

Handles both single items and batch arrays. Haptic feedback on delete (medium) and undo (success).

---

## 6. Offline-First Architecture

### Design

All mutations follow the same pattern:

1. **Optimistic update** — UI updates immediately via `LayoutAnimation` + state setter
2. **Online?** — Call service directly
3. **Offline?** — Queue mutation to `mutationQueue`
4. **On reconnect** — Process queue in FIFO order

### Mutation Queue

**File:** `services/offlineQueue/mutationQueue.ts`

Singleton `MutationQueue` class backed by AsyncStorage.

| Property | Value |
|---|---|
| Storage key | `shopping_list_mutation_queue:{namespace}` |
| Namespace | User ID (prevents cross-account leakage) |
| Processing | FIFO, sequential |
| Max retries | 3 attempts per mutation (removed after 3rd failure) |
| Concurrency guard | `isProcessing` flag prevents parallel processing |

Each mutation is stored as:
```typescript
interface PendingMutation {
  id: string;          // UUID
  type: MutationType;  // ADD_ITEM, DELETE_ITEM, etc.
  payload: MutationPayload;
  timestamp: number;
  retryCount: number;
}
```

### Cache Layers

```
1. In-memory state (React)  ──  Fastest, lost on unmount
2. AsyncStorage              ──  Persists across app restarts
   - collapsed_categories_{listId}
   - selection_state_{listId}
   - shopping_list_mutation_queue:{userId}
3. Supabase (PostgreSQL)     ──  Source of truth
```

### UI Feedback

The `OfflineBanner` component (`components/common/OfflineBanner.tsx`) displays:
- **Offline:** "You're offline" + pending change count
- **Syncing:** "Syncing..." with pulse animation
- **Online:** Hidden

Animated slide-in/out with spring effect.

---

## 7. Key Components

### `CategorySection`
**File:** `components/shopping-list/CategorySection.tsx`

Collapsible category group. Unchecked items rendered in a `DraggableFlatList` (drag-to-reorder); checked items are static. In selection mode, the header shows a select-all toggle for the category.

### `ShoppingListItemRow`
**File:** `components/shopping-list/ShoppingListItem.tsx`

Individual item row. Features:
- Checkbox toggle with haptic feedback
- Quantity display with optional +/- stepper
- Swipe-to-delete gesture (threshold at -80px to reveal, -120px to execute)
- Strikethrough styling when checked
- Selection indicator (blue background) in select mode
- Item image via `expo-image` with fallback

### `DraggableShoppingListItem`
**File:** `components/shopping-list/DraggableShoppingListItem.tsx`

Wraps `ShoppingListItemRow` with a drag handle (reorder-three icon). Shows scale + shadow when actively dragging. Hidden in select mode.

### `AddItemModal`
**File:** `components/shopping-list/AddItemModal.tsx`

Modal for adding items. Ingredient search with 300ms debounce and race condition protection. Quick-select quantity buttons (1, 2, 3, 4, 6, 12). Category pill selector. Optional notes field.

### `FloatingActionBar`
**File:** `components/shopping-list/FloatingActionBar.tsx`

Floating toolbar shown in selection mode. Buttons: Select All / Deselect All, Check, Uncheck, Delete. Each button shows a loading spinner during async operations. Positioned 100px from bottom.

### `ShoppingListCard`
**File:** `components/shopping-list/ShoppingListCard.tsx`

Card for lists overview. Shows name, progress bar, item counts, and last-updated timestamp. Completion badge when all items checked.

---

## 8. Services & API Layer

### `shoppingListService`
**File:** `services/shoppingListService.ts`

Extends `BaseService` (auto camelCase ↔ snake_case transformation).

| Method | Description |
|---|---|
| `getLists()` | Fetch all lists for current user |
| `getListById(id)` | Fetch list with items and categories (nested joins) |
| `createList(name)` | Insert new list |
| `updateList(id, updates)` | Update list metadata |
| `deleteList(id)` | Delete list (cascades to items) |
| `addItem(item)` | Insert item with ingredient or custom name |
| `updateItem(id, updates)` | Update item fields |
| `deleteItem(id)` | Delete single item |
| `batchUpdateItems(ids, updates, listId)` | Batch check/uncheck |
| `batchDeleteItems(ids, listId)` | Batch delete |
| `reorderItems(updates)` | RPC call to `update_shopping_list_item_orders` |
| `consolidateItems(listId)` | Merge duplicates, return `ConsolidationResult` |
| `searchIngredients(query)` | Search ingredients table for suggestions |
| `getCategories()` | Fetch all shopping categories |

### `pantryService`
**File:** `services/pantryService.ts`

| Method | Description |
|---|---|
| `getPantryItems()` | Fetch user's pantry items grouped by category |
| `addPantryItem(item)` | Add to pantry |
| `updatePantryItem(id, updates)` | Update pantry item |
| `deletePantryItem(id)` | Remove from pantry |
| `getFavorites()` | Fetch favorite items |
| `addFavorite(item)` | Add to favorites |
| `deleteFavorite(id)` | Remove from favorites |
| `addFavoriteToList(favoriteId, listId)` | Copy a favorite into a shopping list |

### Shared Mappers
**File:** `services/utils/mapSupabaseItem.ts`

- `getLanguageSuffix()` — Returns `'_en'` or `'_es'` based on current locale
- `getLocalizedCategoryName(category)` — Returns `name_en` or `name_es`
- `mapIngredient(raw)` — Maps Supabase ingredient row to app type
- `mapMeasurementUnit(raw)` — Maps measurement unit row

### Supabase Patterns

- **Nested joins:** `select('*, ingredient:ingredients(*), unit:measurement_units(*)')`
- **Optional rows:** `.maybeSingle()` for queries that might return nothing
- **Case transform:** `BaseService.transformResponse/Request` auto-converts between camelCase (app) and snake_case (DB)
- **RPC:** `supabase.rpc('update_shopping_list_item_orders', { updates: [...] })`

---

## 9. Internationalization

### Translation Keys

**Files:**
- `i18n/locales/en/shoppingList.ts`
- `i18n/locales/es/shoppingList.ts`

Namespace: `shoppingList.*`

Key areas covered:
- List CRUD messages (`listCreated`, `createListError`, etc.)
- Item actions (`itemAdded`, `itemDeleted`, `itemRestored`, etc.)
- Batch operations (`batchCheck`, `batchDelete`, `batchDeleteConfirm`, etc.)
- Offline status (`offline`, `syncing`, `pendingChanges`, `syncComplete`)
- Accessibility labels (`accessibility.listSummary`, `accessibility.toggleItem`, etc.)
- Empty states (`empty`, `emptyPantry`, `emptyFavorites`)
- UI labels (`selectAll`, `clearChecked`, `consolidate`, etc.)

### Dual Localization Pattern

1. **UI strings** — `i18n.t('shoppingList.key')` from translation files
2. **DB content** — `name_en` / `name_es` columns resolved via `getLanguageSuffix()`:
   ```typescript
   const suffix = getLanguageSuffix(); // '_en' or '_es'
   const name = category[`name${suffix}`];
   ```
3. **Convenience helper** — `getLocalizedCategoryName(category)` encapsulates the pattern

---

## 10. Testing

### Test Files

| File | What it tests |
|---|---|
| `services/__tests__/shoppingListService.test.ts` | Cache integration, RPC parameter transformation |
| `services/__tests__/pantryService.test.ts` | Pantry CRUD operations |
| `services/offlineQueue/__tests__/mutationQueue.test.ts` | Queue enqueue/dequeue, retry logic, FIFO processing |
| `hooks/__tests__/useShoppingListData.test.ts` | Offline add mutation queuing, delete error recovery |
| `hooks/__tests__/useSelectionMode.test.ts` | Select all, clear on toggle |
| `hooks/__tests__/useBatchActions.test.ts` | Batch check/delete with optimistic updates |
| `components/shopping-list/__tests__/CategorySection.test.tsx` | Selection count display, accessibility labels |
| `components/shopping-list/__tests__/ShoppingListItemRow.test.tsx` | Rendering, checkbox, quantity controls |
| `components/shopping-list/__tests__/DraggableShoppingListItem.test.tsx` | Drag handle visibility and callback |
| `components/shopping-list/__tests__/AddItemModal.test.tsx` | Search debounce, suggestion rendering |
| `components/shopping-list/__tests__/FloatingActionBar.test.tsx` | Button visibility, callback invocation |
| `components/shopping-list/__tests__/ShoppingListCard.test.tsx` | Name and count rendering |
| `components/common/__tests__/OfflineBanner.test.tsx` | Conditional rendering, pending count |

### Test Factories

**File:** `test/factories/shopping-list.factory.ts`

```typescript
import { shoppingListFactory } from '@/test/factories';

shoppingListFactory.create()                          // ShoppingList
shoppingListFactory.createList(5)                     // ShoppingList[]
shoppingListFactory.createItem()                      // ShoppingListItem
shoppingListFactory.createItemList(3)                 // ShoppingListItem[]
shoppingListFactory.createCategory()                  // ShoppingCategory
shoppingListFactory.createCategoryWithItems({}, 4)    // ShoppingCategoryWithItems
shoppingListFactory.createWithItems({}, 2, 3)         // ShoppingListWithItems
shoppingListFactory.createIngredientSuggestion()      // IngredientSuggestion
```

### Running Tests

```bash
# All shopping list tests
npx jest --testPathPattern="shopping" --no-coverage

# Specific file
npx jest services/__tests__/shoppingListService.test.ts

# Hook tests
npx jest hooks/__tests__/useShoppingListData.test.ts

# Component tests
npx jest components/shopping-list/__tests__/CategorySection.test.tsx
```

### Key Mocks

- **Supabase client** — mocked via `@/test/mocks/supabase`
- **AsyncStorage** — mocked via `@react-native-async-storage/async-storage/jest/async-storage-mock`
- **NetInfo** — mocked for offline/online state transitions
- **react-native-draggable-flatlist** — mocked to render children without animation
- **expo-haptics** — mocked to no-op

---

## 11. Extension Guide

### Adding a new item action

1. Add handler in `useShoppingListData` (optimistic update + service call + rollback)
2. Wire it through the screen (`[id].tsx`) to the component
3. If it needs offline support, add a `MutationType` to `mutationQueue.ts` and handle it in `useOfflineSync`'s executor
4. Add i18n keys for success/error messages in both `en` and `es`
5. Add test in the relevant `__tests__/` directory

### Adding a new batch operation

1. Add the handler in `useBatchActions` following the pattern of `handleBatchToggle`:
   - Save previous list state for rollback
   - Apply `LayoutAnimation` + optimistic update
   - Call service (or queue mutation if offline)
   - Show toast on success, rollback on error
2. Add button to `FloatingActionBar` with loading state
3. Add i18n keys
4. Add test in `hooks/__tests__/useBatchActions.test.ts`

### Adding a new screen/tab

1. Create `app/(tabs)/shopping/newscreen.tsx`
2. Register in `_layout.tsx` — add `<Stack.Screen name="newscreen" ... />`
3. Add navigation from existing screens (e.g., header button or tab)
4. Add i18n keys for screen title

### Adding offline support to a new mutation

1. Add the mutation type to `MutationType` union in `services/offlineQueue/mutationQueue.ts`
2. Add its payload type to `MutationPayloads` interface
3. In the executor function (inside `useOfflineSync`), add a `case` to process the mutation
4. In the hook that triggers the mutation, check `isOffline` and call `queueMutation()` instead of the service directly

### Adding a new database field end-to-end

1. **Migration:** Create `yyx-server/db/migrations/013_add_new_field.sql` with `ALTER TABLE`
2. **Type:** Update the interface in `types/shopping-list.types.ts`
3. **Service:** Update the service's select query to include the new column; update mappers if needed
4. **Hook:** Expose the field through the hook's return value
5. **Component:** Render the field in the appropriate component
6. **Test:** Update factories in `test/factories/shopping-list.factory.ts` to include the new field
7. **Run locally:** `cd yyx-server && supabase db reset` to test the migration

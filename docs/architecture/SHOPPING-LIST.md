# Shopping List — Architecture

This document is the canonical description of the shopping-list feature: what ships, where the code lives, and the decisions that shaped it. New contributors and AI agents should read this before touching shopping-related code.

## Audience

Lupita-first. The "majority segment" of YummyYummix users is a 55+ home cook who is not technologically adventurous. The whole feature is designed around: one tap target per concern, no hidden gestures, visible affordances, durable writes, and forgiving errors. Sofía's needs are met as a side effect.

## What ships

- A top-level **Shopping** tab in the bottom nav.
- A list of the user's shopping lists (Mi Menú-style names like "Mi Menú - 4 may"), sorted by `updated_at`.
- A detail screen with categories, items, edit modal, undo toast, and a select-mode for batch ops.
- Two write paths from elsewhere in the app:
  1. **Recipe → list** — "Add to Shopping List" from any recipe page.
  2. **Planner → list** — "Make My List" from the meal planner.
- Offline-first writes via a durable mutation queue.

## Data model

Six tables shipped in `20260413000001_add_shopping_list.sql`. All RLS-scoped to `auth.uid() = user_id`.

| Table | Purpose | Status |
|---|---|---|
| `shopping_list_categories` | 12 fixed categories (produce, dairy, …, other) | Active |
| `shopping_lists` | One row per user's named list (soft-archive via `is_archived`) | Active |
| `shopping_list_items` | The items themselves | Active |
| `pantry_items` | What's at home | **Deferred** — see [deferred plan](../../../product-kitchen/repeat-what-works/plans/deferred/shopping-list-future-features.md) |
| `favorite_shopping_items` | "Buy again" / weekly staples | **Deferred** |
| `purchase_history` | Append-only log of checkoffs | **Deferred** (and mis-named — see deferred plan for rename to `checkoff_history`) |

**Categories** use TEXT primary keys (`'produce'`, `'dairy'`, …) rather than UUIDs. Trades referential clarity for simpler client code; categories flow as discriminator strings everywhere. The 12 rows are seeded inline in the migration; adding a new category requires a new migration, not application code.

**`shopping_list_items` has a CHECK constraint** `item_has_name CHECK (ingredient_id IS NOT NULL OR name_custom IS NOT NULL)`. Items are either canonical (joined to `ingredients` for image/translation) or custom (only `name_custom`). The same row schema covers both shapes.

**`name_custom` is an override.** When set, it wins over the canonical translation in display — see `mapIngredient` in `services/utils/mapSupabaseItem.ts`. This is what lets users rename an "apple" row to "Granny Smith" without losing the canonical link.

**`measurement_units.base_factor`** (added in `20260505190000_add_measurement_unit_base_factor.sql`) is the multiplier from one of that unit to the dimension's base unit (g for weight, ml for volume). Discrete units (clove, piece, pinch) have NULL — not convertible.

## Read paths

| Function | Purpose |
|---|---|
| `shoppingListService.getShoppingLists()` | Index summary with item counts |
| `shoppingListService.getShoppingListById(id)` | Full detail with items grouped into categories, sorted alphabetically by name |
| `shoppingListService.getCategories()` | Static category list (cached) |
| `shoppingListService.getMeasurementUnits()` | Static unit catalog (cached, locale-keyed) |
| `shoppingListService.getAllIngredients()` | All ingredient translations for the active locale (cached, powers in-memory search) |

Three-tier AsyncStorage cache in `services/cache/shoppingListCache.ts`: lists summary, list detail, categories. Per-user keyed. Invalidated on every mutation.

Items are sorted **alphabetically by name** in `getShoppingListById`. The `display_order` column is informational only — drag-to-reorder was removed from the UX in favor of always-alphabetical (one of the simplifications that lets Lupita predict where things will be).

## Write paths

### Direct CRUD (online + offline queue)

`useShoppingListData` is the orchestration hook. It owns optimistic state for the detail screen and routes every mutation through `useOfflineSync`.

When **online**: optimistic update → service call → cache invalidation → on error, rollback.

When **offline**: optimistic update → enqueue in `mutationQueue` (AsyncStorage) → reconnect triggers FIFO replay → `onSyncComplete` forces a fresh refetch.

The mutation queue (`services/offlineQueue/mutationQueue.ts`) is per-user-namespaced (`shopping_list_mutation_queue:<user_id>`) so account-switching never replays another user's queue. Up to 3 retries per mutation before drop with a logged warning.

### Undoable delete

`hooks/useUndoableDelete` wraps every delete in a 5-second window. The optimistic remove fires immediately; the actual `deleteItem` call is deferred. Undoing reinserts the item alphabetically. The toast UI (`components/common/UndoToast.tsx`) is a singleton imperative API mounted once at app root.

### Recipe → list

`AddToShoppingListModal` (opened from any recipe page) calls `shoppingListService.addRecipeIngredients(listId, ingredients)`. The service:

1. Loads the unit catalog once (cached).
2. Loads existing rows on the target list, indexes by **consolidation key**.
3. Looks up each ingredient's `default_category_id` in one batched query so new rows land in the right category.
4. For each incoming ingredient: try to merge into an existing row → else try to merge into a pending insert from this same batch → else create a new insert.
5. Insert and update in two RPCs.

**Consolidation key** (in `services/utils/unitConversion.ts`):

- Free-text rows (no ingredient_id) never consolidate.
- Convertible units (mass, volume — i.e. those with `base_factor`) key by `(ingredient_id, dimension)`. **All g/kg/oz/lb of the same ingredient collapse into one row.** Quantities are converted to the existing row's unit before summing.
- Discrete units (clove, piece, etc., no `base_factor`) key by `(ingredient_id, unit_id)` — same as pre-PR behavior. Same unit merges; different units stay split.

This is what makes "200g flour + 1kg flour → 1.2 kg flour" work, while "115g oil + 5ml oil" stays as two rows (different dimensions).

### Planner → list

`useMealPlan.shoppingListMutation` calls the meal-planner edge function with action `generate_shopping_list`.

The edge function (`yyx-server/supabase/functions/meal-planner/generate-shopping-list.ts`):

1. Verifies plan ownership (RLS would too, but explicit gives a clean 404).
2. Loads active slots (`status IN ('planned', 'cooked')`) with their components.
3. Expands each `source_kind = 'recipe'` component into its `recipe_ingredients`.
4. Looks up `default_category_id` per ingredient in one batched query.
5. Loads the `measurement_units` rows referenced by the recipes (for `base_factor`).
6. Consolidates: same `(ingredient_id, dimension)` keying as the frontend; quantities convert to the first-encountered unit.
7. Finds or creates the linked `shopping_lists` row, links it back to `meal_plans.shopping_list_id`.
8. Calls `regenerate_plan_shopping_list_items` RPC for atomic replace.

The RPC (`20260427000001_atomic_regenerate_shopping_list.sql`) DELETEs only rows where `source_meal_plan_slot_id IS NOT NULL`, then INSERTs the new set. **Manually-added rows survive regeneration** because they have null source attribution.

## UX architecture

### Single-mode rows

`components/shopping-list/ShoppingListItem.tsx` is intentionally dumb. The parent (`CategorySection`) owns the mode-dependent behavior. Each row has three non-overlapping interactions:

| Target | Action |
|---|---|
| Checkbox | Toggle `isChecked` (or selection in select-mode) |
| Row body | Open Edit modal |
| ⋯ icon | Open per-row action sheet (Edit / Delete) |
| Long-press anywhere | Enter select mode + select this row |

Items without a canonical image render a `cube-outline` placeholder for vertical alignment. (Edited canonical ingredient names keep the canonical image — see `B-20260505-05` in BUGS.md for the accepted UX trade-off.)

### Select mode

Long-press → header collapses to "Cancel" + "{N} selected", FAB hides, `FloatingActionBar` appears with batch ops (check all, uncheck all, delete all). The same checkbox now toggles selection.

### Add Item modal

`components/shopping-list/AddItemModal.tsx`. Single text input, instant client-side search via `searchIngredientsLocal`, keyboard-aware bottom button. `presentationStyle="fullScreen"` so swipe-down doesn't accidentally dismiss.

Search is **synchronous after first warm**. On modal open, fires `getAllIngredients()` (locale-keyed module cache, ~hundreds of rows). Subsequent keystrokes filter in memory. "+ Add 'foo' as new item" submits a custom row directly.

### Edit Item modal

Always-editable name. Trash icon in the modal header (no full-width red delete button). Setting unit to "No unit" clears the row's `unit_id`.

## i18n strategy

- **UI strings** in `i18n/locales/{en,es}/shoppingList.ts`. `i18n-js` with key lookup.
- **Display content** (ingredient names, recipe titles, category names) follows **Sentence case** convention. Documented in [DATABASE-GUIDELINES.md](../agent-guidelines/DATABASE-GUIDELINES.md).
- **Locale fallback for ingredient search**: `getBaseLocale()` strips regional codes (`en-US` → `en`, `es-MX` → `es`) when querying `ingredient_translations`, since the DB only stores base-language rows. Without this fallback, devices set to regional locales saw zero suggestions. See `services/utils/mapSupabaseItem.ts`.

## Decisions encoded

1. **TEXT category IDs.** Categories are a fixed enum-like set; UUIDs added churn for no benefit. The 12 IDs flow as discriminator strings.

2. **Canonical-vs-custom items in one table.** A `CHECK` constraint enforces `ingredient_id IS NOT NULL OR name_custom IS NOT NULL`. Two tables would have meant two read paths and double indexing.

3. **`name_custom` overrides canonical translation.** When a user edits a canonical ingredient's name, the override applies on display. The image stays canonical (accepted UX — see B-20260505-05).

4. **Items sort alphabetically.** Drag-to-reorder was removed; alphabetical-by-name is more predictable for Lupita and removes a gesture conflict on long-press-select.

5. **First-encountered unit wins on consolidation.** When merging "100g flour" + "1kg flour", the result row uses whatever unit the first item had. Promoting to the largest unit ("1.1 kg") would surprise users; `formatQuantity` handles small-fraction display anyway.

6. **DB is source of truth for unit conversions.** `measurement_units.base_factor` is the canonical conversion table. Every consumer (frontend service, edge function, future nutrition calc) reads it, never duplicates it. Per-ingredient density (1 cup flour = 120g) will live in a future `ingredient_unit_conversions` table when nutrition lands.

7. **Common-fraction display.** `utils/formatQuantity.ts` snaps decimals to 1/8, 1/4, 1/3, 1/2, 2/3, 3/4, 7/8 within tolerance 0.05. "0.3 cdta" displays as "1/3 cdta" because cooks read recipes in fractions, not decimals.

8. **Strip noisy success toasts.** Confirmations of actions the user just took are noise. Only error toasts (`Alert.alert`) and the undo toast on delete remain. UI changes ARE the success confirmation.

9. **Atomic regenerate, never empty.** The planner→list flow uses a single RPC for DELETE + INSERT inside a transaction. A partial failure cannot leave the user with an emptied list.

10. **Per-user mutation queue namespacing.** Switching accounts doesn't replay another user's offline mutations.

## Future plans

See [the deferred plan](../../../product-kitchen/repeat-what-works/plans/deferred/shopping-list-future-features.md) for full detail on:

- **Pantry feature** (using existing `pantry_items` table)
- **Favorites / Buy Again** (using existing `favorite_shopping_items` table)
- **Checkoff history** (rename of `purchase_history`, used as a *signal* for favorites suggestions)
- **Per-ingredient unit conversions** (when nutrition ships)
- **Cross-list sharing** (couples cooking together)

## Known issues

Tracked in [`product-kitchen/repeat-what-works/BUGS.md`](../../../product-kitchen/repeat-what-works/BUGS.md):

- **B-20260505-01** — Shopping-list edits lost when user kills app mid-save (P3). Online-mode edits go straight to the network rather than through the mutation queue; force-quitting before completion loses the optimistic update. Real fix is to route every edit through the queue.
- **B-20260505-05** — Edited canonical ingredient keeps original image (P3, accepted UX).

## RPCs

`regenerate_plan_shopping_list_items(p_plan_id, p_list_id, p_items)` — see [DATABASE_FUNCTIONS.md](../../yyx-server/docs/DATABASE_FUNCTIONS.md).

## Key files

| Path | Role |
|---|---|
| `services/shoppingListService.ts` | All CRUD, recipe→list consolidation |
| `services/utils/mapSupabaseItem.ts` | Canonical-vs-custom mapping, locale helpers |
| `services/utils/unitConversion.ts` | Pure conversion math + consolidation key |
| `services/offlineQueue/mutationQueue.ts` | Durable AsyncStorage queue |
| `hooks/useShoppingListData.ts` | Orchestration hook with optimistic updates |
| `hooks/useOfflineSync.ts` | Network-aware queue replay |
| `hooks/useUndoableDelete.ts` | 5s undo window |
| `components/common/UndoToast.tsx` | Singleton imperative toast |
| `components/shopping-list/*` | UI components |
| `app/(tabs)/shopping/{index,[id]}.tsx` | Screens |
| `utils/formatQuantity.ts` | Decimal → fraction display |
| `yyx-server/supabase/functions/meal-planner/generate-shopping-list.ts` | Planner→list edge function |

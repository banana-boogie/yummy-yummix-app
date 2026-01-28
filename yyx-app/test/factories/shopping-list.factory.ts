/**
 * Shopping List Test Data Factory
 *
 * Generates shopping list data for tests.
 *
 * FOR AI AGENTS:
 * - Use these factories instead of manually creating test data
 * - Override only the fields relevant to your test
 * - Use createList() for tests needing multiple items
 */

import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingCategory,
  ShoppingCategoryWithItems,
  ShoppingListWithItems,
  IngredientSuggestion,
} from '@/types/shopping-list.types';

// ============================================================
// COUNTER FOR UNIQUE IDS
// ============================================================

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================
// SAMPLE DATA POOLS
// ============================================================

const listNames = [
  'Weekly Groceries',
  'Weekend BBQ',
  'Holiday Baking',
  'Meal Prep',
  'Party Snacks',
];

const itemNames = [
  'Milk',
  'Eggs',
  'Bread',
  'Apples',
  'Chicken',
  'Rice',
];

const categories: Array<Pick<ShoppingCategory, 'id' | 'nameEn' | 'nameEs' | 'icon' | 'displayOrder'>> = [
  { id: 'produce', nameEn: 'Produce', nameEs: 'Frutas y Verduras', icon: 'leaf-outline', displayOrder: 1 },
  { id: 'dairy', nameEn: 'Dairy & Eggs', nameEs: 'Lácteos y Huevos', icon: 'egg-outline', displayOrder: 2 },
  { id: 'pantry', nameEn: 'Pantry Staples', nameEs: 'Despensa', icon: 'file-tray-full-outline', displayOrder: 3 },
  { id: 'other', nameEn: 'Other', nameEs: 'Otros', icon: 'ellipsis-horizontal-outline', displayOrder: 4 },
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// ============================================================
// FACTORY FUNCTIONS
// ============================================================

export function createShoppingCategory(
  overrides: Partial<ShoppingCategory> = {}
): ShoppingCategory {
  const base = randomElement(categories);
  return {
    id: base.id,
    nameEn: base.nameEn,
    nameEs: base.nameEs,
    icon: base.icon,
    displayOrder: base.displayOrder,
    ...overrides,
  };
}

export function createShoppingList(
  overrides: Partial<ShoppingList> = {}
): ShoppingList {
  const now = new Date().toISOString();
  return {
    id: generateId('list'),
    userId: generateId('user'),
    name: randomElement(listNames),
    isArchived: false,
    itemCount: 0,
    checkedCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createShoppingListItem(
  overrides: Partial<ShoppingListItem> = {}
): ShoppingListItem {
  const now = new Date().toISOString();
  const category = createShoppingCategory();
  return {
    id: generateId('item'),
    shoppingListId: generateId('list'),
    ingredientId: generateId('ingredient'),
    categoryId: category.id,
    name: randomElement(itemNames),
    pluralName: undefined,
    pictureUrl: undefined,
    quantity: 1,
    unit: undefined,
    notes: undefined,
    isChecked: false,
    checkedAt: undefined,
    recipeId: undefined,
    displayOrder: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createShoppingListItemList(
  count: number,
  overrides: Partial<ShoppingListItem> = {}
): ShoppingListItem[] {
  return Array.from({ length: count }, (_, index) =>
    createShoppingListItem({ displayOrder: index + 1, ...overrides })
  );
}

export function createShoppingCategoryWithItems(
  overrides: Partial<ShoppingCategoryWithItems> = {},
  itemsCount = 2
): ShoppingCategoryWithItems {
  const category = createShoppingCategory(overrides);
  const items = createShoppingListItemList(itemsCount, { categoryId: category.id });
  return {
    ...category,
    localizedName: category.nameEn,
    items,
    ...overrides,
  };
}

export function createShoppingListWithItems(
  overrides: Partial<ShoppingListWithItems> = {},
  categoriesCount = 2,
  itemsPerCategory = 2
): ShoppingListWithItems {
  const list = createShoppingList(overrides);
  const categoriesWithItems = Array.from({ length: categoriesCount }, () =>
    createShoppingCategoryWithItems({}, itemsPerCategory)
  );
  const items = categoriesWithItems.flatMap((category) =>
    category.items.map((item) => ({ ...item, shoppingListId: list.id }))
  );

  const checkedCount = items.filter((item) => item.isChecked).length;

  return {
    ...list,
    itemCount: items.length,
    checkedCount,
    items,
    categories: categoriesWithItems.map((category) => ({
      ...category,
      items: category.items.map((item) => ({ ...item, shoppingListId: list.id })),
    })),
    ...overrides,
  };
}

export function createIngredientSuggestion(
  overrides: Partial<IngredientSuggestion> = {}
): IngredientSuggestion {
  const category = createShoppingCategory();
  return {
    id: generateId('ingredient'),
    name: randomElement(itemNames),
    pluralName: `${randomElement(itemNames)}s`,
    pictureUrl: undefined,
    categoryId: category.id,
    ...overrides,
  };
}

// ============================================================
// FACTORY OBJECT EXPORT
// ============================================================

export const shoppingListFactory = {
  create: createShoppingList,
  createList: (count: number, overrides: Partial<ShoppingList> = {}) =>
    Array.from({ length: count }, () => createShoppingList(overrides)),
  createItem: createShoppingListItem,
  createItemList: createShoppingListItemList,
  createCategory: createShoppingCategory,
  createCategoryWithItems: createShoppingCategoryWithItems,
  createWithItems: createShoppingListWithItems,
  createIngredientSuggestion,
  resetIdCounter,
};

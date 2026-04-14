import { MeasurementUnit } from './recipe.types';

// ============================================
// SHOPPING LISTS
// ============================================

export interface ShoppingList {
    id: string;
    userId: string;
    name: string;
    isArchived: boolean;
    itemCount: number;
    checkedCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface ShoppingListWithItems extends ShoppingList {
    items: ShoppingListItem[];
    categories: ShoppingCategoryWithItems[];
}

// ============================================
// SHOPPING LIST ITEMS
// ============================================

export interface ShoppingListItem {
    id: string;
    shoppingListId: string;
    ingredientId?: string;
    categoryId: string;
    name: string;
    pluralName?: string;
    pictureUrl?: string;
    quantity: number;
    unit?: MeasurementUnit;
    notes?: string;
    isChecked: boolean;
    checkedAt?: string;
    recipeId?: string;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface ShoppingListItemCreate {
    shoppingListId: string;
    ingredientId?: string;
    categoryId: string;
    nameCustom?: string;
    quantity: number;
    unitId?: string;
    notes?: string;
    recipeId?: string;
}

export interface ShoppingListItemUpdate {
    quantity?: number;
    unitId?: string;
    notes?: string;
    isChecked?: boolean;
    displayOrder?: number;
    categoryId?: string;
}

// ============================================
// CATEGORIES
// ============================================

export interface ShoppingCategory {
    id: string;
    nameEn: string;
    nameEs: string;
    icon: string;
    displayOrder: number;
}

export interface ShoppingCategoryWithItems extends ShoppingCategory {
    items: ShoppingListItem[];
    localizedName: string;
}

// ============================================
// PANTRY
// ============================================

export interface PantryItem {
    id: string;
    userId: string;
    ingredientId?: string;
    categoryId: string;
    name: string;
    pluralName?: string;
    pictureUrl?: string;
    quantity: number;
    unit?: MeasurementUnit;
    createdAt: string;
    updatedAt: string;
}

export interface PantryItemCreate {
    ingredientId?: string;
    categoryId: string;
    nameCustom?: string;
    quantity: number;
    unitId?: string;
}

export interface PantryItemUpdate {
    quantity?: number;
    unitId?: string;
    categoryId?: string;
}

// ============================================
// FAVORITES
// ============================================

export interface FavoriteShoppingItem {
    id: string;
    userId: string;
    ingredientId?: string;
    categoryId: string;
    name: string;
    pluralName?: string;
    pictureUrl?: string;
    defaultQuantity: number;
    defaultUnit?: MeasurementUnit;
    purchaseCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface FavoriteShoppingItemCreate {
    ingredientId?: string;
    categoryId: string;
    nameCustom?: string;
    defaultQuantity: number;
    defaultUnitId?: string;
}

// ============================================
// API TYPES
// ============================================

export interface IngredientSuggestion {
    id: string;
    name: string;
    pluralName: string;
    pictureUrl?: string;
    categoryId: string;
}

export interface ConsolidationResult {
    merged: number;
    items: ShoppingListItem[];
}

export const CATEGORY_ICONS: Record<string, string> = {
    produce: 'leaf-outline',
    dairy: 'egg-outline',
    meat: 'fish-outline',
    bakery: 'cafe-outline',
    pantry: 'file-tray-full-outline',
    frozen: 'snow-outline',
    beverages: 'wine-outline',
    snacks: 'pizza-outline',
    spices: 'flask-outline',
    household: 'home-outline',
    personal: 'heart-outline',
    other: 'ellipsis-horizontal-outline',
} as const;

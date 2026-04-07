import { AdminRecipeIngredient } from '@/types/recipe.admin.types';

export type SortableIngredientListProps = {
  /** Sorted sections: [sectionName, ingredients][] */
  sections: [string, AdminRecipeIngredient[]][];
  displayLocale: string;
  /** Called after drag-reorder with the new sorted array for the section */
  onReorder: (sectionName: string, reorderedIngredients: AdminRecipeIngredient[]) => void;
  onEdit: (ingredient: AdminRecipeIngredient) => void;
  onDelete: (ingredient: AdminRecipeIngredient) => void;
  /** Move an entire section up or down */
  onMoveSection: (sectionName: string, direction: 'up' | 'down') => void;
};

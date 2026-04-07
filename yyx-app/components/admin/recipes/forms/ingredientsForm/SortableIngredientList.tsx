import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { AdminRecipeIngredient } from '@/types/recipe.admin.types';
import { AdminRecipeIngredientCard } from '@/components/admin/recipes/forms/ingredientsForm/AdminRecipeIngredientCard';
import { Ionicons } from '@expo/vector-icons';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { SortableIngredientListProps } from '@/components/admin/recipes/forms/ingredientsForm/SortableIngredientList.types';

/**
 * Native fallback: renders ingredient cards with up/down arrow buttons
 * instead of drag-and-drop (which is web-only via @dnd-kit).
 */
export function SortableIngredientList({
  sections,
  displayLocale,
  onReorder,
  onEdit,
  onDelete,
  onMoveSection,
}: SortableIngredientListProps) {
  const handleMoveUp = (
    sectionName: string,
    sortedIngredients: AdminRecipeIngredient[],
    index: number
  ) => {
    if (index <= 0) return;
    const reordered = [...sortedIngredients];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    onReorder(sectionName, reordered);
  };

  const handleMoveDown = (
    sectionName: string,
    sortedIngredients: AdminRecipeIngredient[],
    index: number
  ) => {
    if (index >= sortedIngredients.length - 1) return;
    const reordered = [...sortedIngredients];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    onReorder(sectionName, reordered);
  };

  return (
    <View>
      {sections.map(([sectionName, ingredients], sectionIndex) => {
        const sortedIngredients = [...ingredients].sort(
          (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)
        );

        return (
          <View className="px-sm mb-md" key={`section-${sectionName}`}>
            {/* Section header with move-section arrows */}
            <View className="flex-row justify-between items-center mb-sm pb-xs border-b border-border-default">
              {shouldDisplayRecipeSection(sectionName) ? (
                <Text preset="subheading" className="font-semibold flex-1">
                  {sectionName}
                </Text>
              ) : null}

              <View className="flex-row items-center gap-xs">
                <TouchableOpacity
                  className={`p-1 rounded-sm bg-background-default shadow-sm ${sectionIndex === 0 ? 'opacity-50' : ''}`}
                  onPress={() => onMoveSection(sectionName, 'up')}
                  disabled={sectionIndex === 0}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Ionicons
                    name="chevron-up"
                    size={20}
                    className={sectionIndex === 0 ? 'text-text-secondary' : 'text-primary-default'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  className={`p-1 rounded-sm bg-background-default shadow-sm ${sectionIndex === sections.length - 1 ? 'opacity-50' : ''}`}
                  onPress={() => onMoveSection(sectionName, 'down')}
                  disabled={sectionIndex === sections.length - 1}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    className={sectionIndex === sections.length - 1 ? 'text-text-secondary' : 'text-primary-default'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Ingredient cards with up/down buttons */}
            {sortedIngredients.map((ingredient, index) => (
              <View key={ingredient.id}>
                <AdminRecipeIngredientCard
                  recipeIngredient={ingredient}
                  displayLocale={displayLocale}
                  onEditPress={() => onEdit(ingredient)}
                  onDeletePress={() => onDelete(ingredient)}
                  onMoveUpPress={() => handleMoveUp(sectionName, sortedIngredients, index)}
                  onMoveDownPress={() => handleMoveDown(sectionName, sortedIngredients, index)}
                  isFirst={index === 0}
                  isLast={index === sortedIngredients.length - 1}
                />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export default SortableIngredientList;

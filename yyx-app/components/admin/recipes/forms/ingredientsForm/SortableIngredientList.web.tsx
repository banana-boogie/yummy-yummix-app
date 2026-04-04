import React, { useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Text } from '@/components/common/Text';
import { AdminRecipeIngredient } from '@/types/recipe.admin.types';
import { AdminRecipeIngredientCard } from '@/components/admin/recipes/forms/ingredientsForm/AdminRecipeIngredientCard';
import { Ionicons } from '@expo/vector-icons';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { SortableIngredientListProps } from '@/components/admin/recipes/forms/ingredientsForm/SortableIngredientList.types';

function SortableIngredientRow({
  ingredient,
  displayLocale,
  onEdit,
  onDelete,
  isFirst,
  isLast,
}: {
  ingredient: AdminRecipeIngredient;
  displayLocale: string;
  onEdit: () => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ingredient.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 999 : 'auto' as any,
  };

  const dragHandle = (
    <div
      {...attributes}
      {...listeners}
      style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: 4 }}
    >
      <Ionicons name="reorder-three" size={18} className="text-text-secondary" />
    </div>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <AdminRecipeIngredientCard
        recipeIngredient={ingredient}
        displayLocale={displayLocale}
        onEditPress={onEdit}
        onDeletePress={onDelete}
        isFirst={isFirst}
        isLast={isLast}
        dragHandle={dragHandle}
      />
    </div>
  );
}

export function SortableIngredientList({
  sections,
  displayLocale,
  onReorder,
  onEdit,
  onDelete,
  onMoveSection,
}: SortableIngredientListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    (sectionName: string, sortedIngredients: AdminRecipeIngredient[]) =>
      (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = sortedIngredients.findIndex((ing) => ing.id === active.id);
        const newIndex = sortedIngredients.findIndex((ing) => ing.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sortedIngredients, oldIndex, newIndex);
        onReorder(sectionName, reordered);
      },
    [onReorder]
  );

  return (
    <View>
      {sections.map(([sectionName, ingredients], sectionIndex) => {
        const sortedIngredients = [...ingredients].sort(
          (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)
        );
        const ids = sortedIngredients.map((ing) => ing.id);

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

            {/* Sortable ingredient cards */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd(sectionName, sortedIngredients)}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {sortedIngredients.map((ingredient, index) => (
                  <SortableIngredientRow
                    key={ingredient.id}
                    ingredient={ingredient}
                    displayLocale={displayLocale}
                    onEdit={() => onEdit(ingredient)}
                    onDelete={() => onDelete(ingredient)}
                    isFirst={index === 0}
                    isLast={index === sortedIngredients.length - 1}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </View>
        );
      })}
    </View>
  );
}

export default SortableIngredientList;

import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/common/Text';
import { AdminRecipeUsefulItem } from '@/types/recipe.admin.types';
import { AdminRecipeUsefulItemCard } from '@/components/admin/recipes/forms/usefulItemsForm/AdminRecipeUsefulItemCard';

interface RecipeUsefulItemsListProps {
  usefulItems: AdminRecipeUsefulItem[];
  title?: string;
  hideActions?: boolean;
}

export const RecipeUsefulItemsList: React.FC<RecipeUsefulItemsListProps> = ({
  usefulItems,
  title,
  hideActions = false
}) => {
  // Sort usefulItems by displayOrder
  const sortedUsefulItems = [...usefulItems].sort(
    (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)
  );

  return (
    <View className="flex-1 w-full">
      {title && (
        <Text preset="h1" fontWeight="700" className="mb-md">
          {title}
        </Text>
      )}

      <ScrollView
        showsVerticalScrollIndicator={true}
        className="flex-1 rounded-md bg-background-SECONDARY"
        contentContainerStyle={{ padding: 8, paddingBottom: 16 }}
      >
        {sortedUsefulItems.length > 0 ? (
          sortedUsefulItems.map(usefulItem => (
            <AdminRecipeUsefulItemCard
              key={usefulItem.id}
              recipeUsefulItem={usefulItem}
              hideActions={hideActions}
              variant="readonly"
            />
          ))
        ) : (
          <View className="p-md items-center justify-center">
            <Text preset="body" color="#6B7280" className="text-center">
              No useful items added to this recipe.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default RecipeUsefulItemsList;
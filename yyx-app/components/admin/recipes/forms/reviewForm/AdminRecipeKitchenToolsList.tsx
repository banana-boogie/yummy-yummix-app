import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/common/Text';
import { AdminRecipeKitchenTool } from '@/types/recipe.admin.types';
import { AdminRecipeKitchenToolCard } from '@/components/admin/recipes/forms/kitchenToolsForm/AdminRecipeKitchenToolCard';

interface AdminRecipeKitchenToolsListProps {
  kitchenTools: AdminRecipeKitchenTool[];
  displayLocale?: string;
  title?: string;
  hideActions?: boolean;
}

export const AdminRecipeKitchenToolsList: React.FC<AdminRecipeKitchenToolsListProps> = ({
  kitchenTools,
  displayLocale = 'es',
  title,
  hideActions = false
}) => {
  // Sort kitchenTools by displayOrder
  const sortedKitchenTools = [...kitchenTools].sort(
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
        {sortedKitchenTools.length > 0 ? (
          sortedKitchenTools.map(kitchenTool => (
            <AdminRecipeKitchenToolCard
              key={kitchenTool.id}
              recipeKitchenTool={kitchenTool}
              displayLocale={displayLocale}
              hideActions={hideActions}
              variant="readonly"
            />
          ))
        ) : (
          <View className="p-md items-center justify-center">
            <Text preset="body" color="#6B7280" className="text-center">
              No kitchen tools added to this recipe.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default AdminRecipeKitchenToolsList;

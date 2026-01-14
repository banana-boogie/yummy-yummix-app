import React from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { Text } from '@/components/common';
import { Cookbook } from '@/types/cookbook.types';
import { CookbookCard } from './CookbookCard';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';

interface CookbookListProps {
    cookbooks: Cookbook[];
    onCookbookPress: (cookbook: Cookbook) => void;
    onCreatePress: () => void;
    isLoading?: boolean;
    emptyMessage?: string;
}

export function CookbookList({
    cookbooks,
    onCookbookPress,
    onCreatePress,
    isLoading = false,
    emptyMessage
}: CookbookListProps) {
    // We'll use 2 columns for now
    const numColumns = 2;

    const renderCreateCard = () => (
        <Pressable
            onPress={onCreatePress}
            className="rounded-lg border-2 border-dashed border-neutral-300 flex-1 mx-xs mb-md h-[160px] items-center justify-center bg-neutral-50 active:bg-neutral-100"
        >
            <View className="bg-white rounded-full p-sm shadow-sm mb-sm">
                <Ionicons name="add" size={32} color="#666" />
            </View>
            <Text preset="body" className="text-text-secondary font-medium">
                {i18n.t('cookbooks.createNew')}
            </Text>
        </Pressable>
    );

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center p-xl">
                <Text preset="body" className="text-text-secondary">{i18n.t('common.loading')}</Text>
            </View>
        );
    }

    // Prepend a "fake" item for the Create button if we want it in the grid, 
    // or handle it as a ListHeaderComponent or separate.
    // Actually, putting it as the first item is cleanest for grid layout.
    const dataWithCreate = [{ id: 'create_new_action', isCreateAction: true } as any, ...cookbooks];

    return (
        <FlatList
            data={dataWithCreate}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
                if (item.isCreateAction) {
                    return renderCreateCard();
                }
                return (
                    <CookbookCard
                        cookbook={item}
                        onPress={() => onCookbookPress(item)}
                    />
                );
            }}
            ListEmptyComponent={
                // Only shows if dataWithCreate is empty, which it won't be because of create button
                // So we handle "empty state" visually via the grid having only the create button
                null
            }
        />
    );
}

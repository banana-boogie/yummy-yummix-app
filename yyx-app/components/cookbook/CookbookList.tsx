import React from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { Text } from '@/components/common';
import { Cookbook } from '@/types/cookbook.types';
import { CookbookCard } from './CookbookCard';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

type CookbookListItem = Cookbook | { id: string; isCreateAction: true };

const gridContentStyle = { padding: 16 } as const;

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
            accessibilityRole="button"
            accessibilityLabel={i18n.t('cookbooks.a11y.createNewCookbook')}
            className="rounded-lg border-2 border-dashed border-neutral-300 flex-1 mx-xs mb-md h-[160px] items-center justify-center bg-neutral-50 active:bg-neutral-100"
        >
            <View className="bg-white rounded-full p-sm shadow-sm mb-sm">
                <Ionicons name="add" size={32} color={COLORS.text.secondary} />
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

    const dataWithCreate: CookbookListItem[] = [
        { id: 'create_new_action', isCreateAction: true },
        ...cookbooks,
    ];

    return (
        <FlatList<CookbookListItem>
            data={dataWithCreate}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            contentContainerStyle={gridContentStyle}
            renderItem={({ item }) => {
                if ('isCreateAction' in item) {
                    return renderCreateCard();
                }
                return (
                    <CookbookCard
                        cookbook={item}
                        onPress={() => onCookbookPress(item)}
                    />
                );
            }}
        />
    );
}

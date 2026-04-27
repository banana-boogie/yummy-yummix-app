import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Dropdown } from '@/components/form/Dropdown';
import { shoppingListService } from '@/services/shoppingListService';
import type { ShoppingCategory } from '@/types/shopping-list.types';
import i18n from '@/i18n';

interface DefaultCategorySectionProps {
    value: string | null | undefined;
    onChange: (categoryId: string | null) => void;
}

const NONE_VALUE = '__none__';

/**
 * Lets an admin pick the shopping-list category an ingredient lands in by
 * default. Stored as ingredients.default_category_id; falls back to "other"
 * when null.
 */
export function DefaultCategorySection({ value, onChange }: DefaultCategorySectionProps) {
    const [categories, setCategories] = useState<ShoppingCategory[]>([]);

    useEffect(() => {
        let cancelled = false;
        shoppingListService
            .getCategories()
            .then((cats) => {
                if (!cancelled) setCategories(cats);
            })
            .catch(() => {
                if (!cancelled) setCategories([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const options = [
        { label: i18n.t('admin.ingredients.defaultCategoryNone'), value: NONE_VALUE },
        ...categories.map((cat) => ({
            label: i18n.locale === 'es' ? cat.nameEs : cat.nameEn,
            value: cat.id,
        })),
    ];

    return (
        <View className="mt-lg mb-md">
            <Text preset="subheading" className="mb-xs">
                {i18n.t('admin.ingredients.defaultCategory')}
            </Text>
            <Text preset="caption" className="text-text-secondary mb-sm">
                {i18n.t('admin.ingredients.defaultCategoryHint')}
            </Text>
            <Dropdown
                options={options}
                selectedValue={value || NONE_VALUE}
                onValueChange={(next) => onChange(next === NONE_VALUE ? null : next)}
            />
        </View>
    );
}

export default DefaultCategorySection;

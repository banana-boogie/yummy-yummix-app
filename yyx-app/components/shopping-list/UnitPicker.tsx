import React, { useEffect, useState } from 'react';
import { View, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { shoppingListService } from '@/services/shoppingListService';
import type { MeasurementUnit } from '@/types/recipe.types';

interface UnitPickerProps {
    value: string | null;
    onChange: (unitId: string | null) => void;
}

/** Minimal unit dropdown. Shows the current unit's symbol; opens a sheet of all units. */
export function UnitPicker({ value, onChange }: UnitPickerProps) {
    const [open, setOpen] = useState(false);
    const [units, setUnits] = useState<MeasurementUnit[]>([]);

    useEffect(() => {
        if (!open || units.length > 0) return;
        shoppingListService.getMeasurementUnits().then(setUnits).catch(() => setUnits([]));
    }, [open, units.length]);

    const current = units.find(u => u.id === value);
    const label = current?.symbol || i18n.t('shoppingList.unitNone');

    return (
        <>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                className="flex-row items-center px-md h-12 rounded-xl bg-grey-lightest border border-grey-light"
                accessibilityRole="button"
                accessibilityLabel={i18n.t('shoppingList.unitLabel')}
            >
                <Text preset="body" className="text-text-default mr-xs">{label}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.grey.medium} />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setOpen(false)}
                    className="flex-1 justify-end bg-black/40"
                >
                    <View className="bg-neutral-white rounded-t-xl p-lg max-h-96">
                        <Text preset="h3" className="mb-md">{i18n.t('shoppingList.pickUnit')}</Text>
                        <FlatList
                            data={[null as MeasurementUnit | null, ...units]}
                            keyExtractor={(item) => item?.id ?? '__none__'}
                            renderItem={({ item }) => {
                                const isActive = (item?.id ?? null) === value;
                                return (
                                    <TouchableOpacity
                                        onPress={() => {
                                            onChange(item?.id ?? null);
                                            setOpen(false);
                                        }}
                                        className={`flex-row items-center justify-between py-sm px-md rounded-md ${isActive ? 'bg-primary-lightest' : ''}`}
                                    >
                                        <View>
                                            <Text preset="body" className="text-text-default">
                                                {item ? item.name : i18n.t('shoppingList.unitNone')}
                                            </Text>
                                            {item?.symbol && item.symbol !== item.name && (
                                                <Text preset="caption" className="text-text-secondary">{item.symbol}</Text>
                                            )}
                                        </View>
                                        {isActive && <Ionicons name="checkmark" size={20} color={COLORS.primary.darkest} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

export default UnitPicker;

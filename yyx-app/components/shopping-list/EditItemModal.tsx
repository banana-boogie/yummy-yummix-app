import React, { useEffect, useState } from 'react';
import { View, Modal, TouchableOpacity, TextInput, ScrollView, Keyboard, Pressable, Platform, KeyboardAvoidingView } from 'react-native';
import { Text, Button } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ShoppingCategory, ShoppingListItem } from '@/types/shopping-list.types';
import { getLocalizedCategoryName } from '@/services/utils/mapSupabaseItem';
import { UnitPicker } from './UnitPicker';

interface EditItemModalProps {
    visible: boolean;
    onClose: () => void;
    item: ShoppingListItem | null;
    categories: ShoppingCategory[];
    onSave: (updates: {
        nameCustom?: string;
        quantity?: number;
        unitId?: string | null;
        categoryId?: string;
        notes?: string;
    }) => Promise<void>;
    onDelete: () => void;
}

/**
 * Edit a shopping list item — name (when custom), quantity, unit, category, notes.
 * Delete lives at the bottom inside the same sheet so the gesture surface on the
 * row stays simple (tap = open here, no swipe needed).
 */
export function EditItemModal({ visible, onClose, item, categories, onSave, onDelete }: EditItemModalProps) {
    const insets = useSafeAreaInsets();
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [unitId, setUnitId] = useState<string | null>(null);
    const [categoryId, setCategoryId] = useState('other');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const isCanonical = !!item?.ingredientId;

    useEffect(() => {
        if (!item) return;
        setName(item.name ?? '');
        setQuantity(String(item.quantity ?? 1));
        setUnitId(item.unit?.id ?? null);
        setCategoryId(item.categoryId ?? 'other');
        setNotes(item.notes ?? '');
    }, [item, visible]);

    const handleSave = async () => {
        if (!item || saving) return;
        setSaving(true);
        try {
            await onSave({
                nameCustom: isCanonical ? undefined : name.trim() || undefined,
                quantity: parseFloat(quantity) || 1,
                unitId,
                categoryId,
                notes: notes.trim() || undefined,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        onDelete();
        onClose();
    };

    if (!item) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 bg-background-primary"
                style={{ paddingTop: insets.top }}
            >
                <View className="flex-row items-center justify-between px-lg py-md border-b border-grey-lightest">
                    <TouchableOpacity onPress={onClose}><Text preset="body" className="text-primary-dark">{i18n.t('common.cancel')}</Text></TouchableOpacity>
                    <Text preset="h3">{i18n.t('shoppingList.editItem')}</Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving}>
                        <Text preset="body" className={saving ? 'text-grey-medium' : 'text-primary-dark font-medium'}>
                            {saving ? i18n.t('shoppingList.saving') : i18n.t('common.save')}
                        </Text>
                    </TouchableOpacity>
                </View>

                <Pressable onPress={Keyboard.dismiss} className="flex-1">
                    <ScrollView className="flex-1 px-lg" contentContainerStyle={{ paddingVertical: 16 }} keyboardShouldPersistTaps="handled">
                        {/* Name */}
                        <View className="mb-md">
                            <Text preset="caption" className="text-text-secondary mb-xs">{i18n.t('shoppingList.itemNamePlaceholder')}</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                editable={!isCanonical}
                                className={`bg-grey-lightest rounded-xl px-md py-md text-text-default text-base ${isCanonical ? 'opacity-60' : ''}`}
                                returnKeyType="done"
                                blurOnSubmit
                            />
                        </View>

                        {/* Quantity + unit */}
                        <View className="mb-md">
                            <Text preset="caption" className="text-text-secondary mb-xs">{i18n.t('shoppingList.item.quantity')}</Text>
                            <View className="flex-row items-center">
                                <TouchableOpacity
                                    onPress={() => setQuantity(String(Math.max(0.5, (parseFloat(quantity) || 1) - 1)))}
                                    className="w-12 h-12 rounded-xl bg-grey-lightest items-center justify-center"
                                ><Ionicons name="remove" size={24} color={COLORS.text.default} /></TouchableOpacity>
                                <TextInput
                                    value={quantity}
                                    onChangeText={setQuantity}
                                    keyboardType="decimal-pad"
                                    className="w-20 h-12 mx-sm text-center text-xl font-medium text-text-default bg-grey-lightest rounded-xl"
                                    returnKeyType="done"
                                    blurOnSubmit
                                />
                                <TouchableOpacity
                                    onPress={() => setQuantity(String((parseFloat(quantity) || 0) + 1))}
                                    className="w-12 h-12 rounded-xl bg-grey-lightest items-center justify-center mr-sm"
                                ><Ionicons name="add" size={24} color={COLORS.text.default} /></TouchableOpacity>
                                <View className="flex-1">
                                    <UnitPicker value={unitId} onChange={setUnitId} />
                                </View>
                            </View>
                        </View>

                        {/* Category */}
                        <View className="mb-md">
                            <Text preset="caption" className="text-text-secondary mb-xs">{i18n.t('shoppingList.item.category')}</Text>
                            <View className="flex-row flex-wrap">
                                {categories.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        onPress={() => setCategoryId(cat.id)}
                                        className={`px-md py-sm rounded-xl mr-xs mb-xs ${categoryId === cat.id ? 'bg-primary-medium' : 'bg-grey-lightest'}`}
                                    >
                                        <Text preset="caption" className={categoryId === cat.id ? 'text-text-default' : 'text-text-secondary'}>
                                            {getLocalizedCategoryName(cat)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Notes */}
                        <View className="mb-md">
                            <Text preset="caption" className="text-text-secondary mb-xs">{i18n.t('shoppingList.item.notes')}</Text>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                placeholder={i18n.t('shoppingList.item.notesPlaceholder')}
                                placeholderTextColor={COLORS.grey.medium}
                                className="bg-grey-lightest rounded-xl px-md py-md text-text-default text-base"
                                multiline
                                numberOfLines={2}
                                returnKeyType="done"
                                blurOnSubmit
                            />
                        </View>

                        {/* Delete button at bottom */}
                        <TouchableOpacity
                            onPress={handleDelete}
                            className="mt-lg flex-row items-center justify-center py-md rounded-xl bg-status-error/10"
                            accessibilityRole="button"
                            accessibilityLabel={i18n.t('shoppingList.deleteItem')}
                        >
                            <Ionicons name="trash-outline" size={20} color={COLORS.status.error} />
                            <Text preset="body" className="ml-sm font-semibold" style={{ color: COLORS.status.error }}>
                                {i18n.t('shoppingList.deleteItem')}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </Pressable>

                <View className="px-lg" style={{ paddingBottom: insets.bottom + 16 }}>
                    <Button onPress={handleSave} disabled={saving} fullWidth>
                        {saving ? i18n.t('shoppingList.saving') : i18n.t('common.save')}
                    </Button>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default EditItemModal;

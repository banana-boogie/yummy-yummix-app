import React, { useState, useCallback, useEffect } from 'react';
import { View, Modal, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, Pressable, Keyboard, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Text, Button } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { shoppingListService } from '@/services/shoppingListService';
import { IngredientSuggestion, ShoppingCategory } from '@/types/shopping-list.types';
import { getLocalizedCategoryName } from '@/services/utils/mapSupabaseItem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UnitPicker } from './UnitPicker';

interface AddItemModalProps {
    visible: boolean;
    onClose: () => void;
    onAddItem: (item: { ingredientId?: string; nameCustom?: string; categoryId: string; quantity: number; unitId?: string; notes?: string; }) => void | Promise<void>;
    categories: ShoppingCategory[];
    /** Pre-fill the item name (used by the filter-or-add affordance on the list page). */
    initialName?: string;
}

export function AddItemModal({ visible, onClose, onAddItem, categories, initialName }: AddItemModalProps) {
    const insets = useSafeAreaInsets();
    const [name, setName] = useState('');
    const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
    const [selectedIngredient, setSelectedIngredient] = useState<IngredientSuggestion | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [unitId, setUnitId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('other');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
    const [allIngredients, setAllIngredients] = useState<IngredientSuggestion[]>([]);

    // Track keyboard visibility — when up, the bottom Button overlaps the
    // category chip section with a transparent background. Hiding it keeps
    // the form readable; the header "Done" button still submits.
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardOpen(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardOpen(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (!visible) return;
        // Reset on open. If parent passed initialName, use it as starting text.
        const seed = initialName ?? '';
        setName(seed);
        setSuggestions([]);
        setSelectedIngredient(null);
        setQuantity('1');
        setUnitId(null);
        setSelectedCategory('other');
        setNotes('');
        setSubmitting(false);
        // Fire-and-forget: warm the in-memory ingredient cache so search is
        // synchronous after the user starts typing. Cache is module-scoped
        // in shoppingListService — repeated opens reuse the first fetch.
        let cancelled = false;
        shoppingListService
            .getAllIngredients()
            .then((rows) => {
                if (!cancelled) setAllIngredients(rows);
            })
            .catch(() => {
                /* swallow — falls back to network search if needed */
            });
        return () => {
            cancelled = true;
        };
    }, [visible, initialName]);

    const handleNameChange = useCallback((value: string) => {
        setName(value);
        // User typing breaks any prior canonical-ingredient pin.
        setSelectedIngredient(null);
        if (value.length < 2) {
            setSuggestions([]);
        }
    }, []);

    // Synchronous in-memory filter — no debounce, instant per keystroke.
    useEffect(() => {
        const trimmed = name.trim();
        if (trimmed.length < 2 || selectedIngredient) {
            setSuggestions([]);
            return;
        }
        if (allIngredients.length === 0) {
            // Cache not warm yet — fall back to a one-shot network search so
            // suggestions still appear if the user beats the prefetch.
            let cancelled = false;
            shoppingListService.searchIngredients(trimmed)
                .then((rows) => {
                    if (!cancelled) setSuggestions(rows);
                })
                .catch(() => { /* best effort */ });
            return () => { cancelled = true; };
        }
        setSuggestions(shoppingListService.searchIngredientsLocal(trimmed, allIngredients));
    }, [name, selectedIngredient, allIngredients]);

    const handleSelectIngredient = (ingredient: IngredientSuggestion) => {
        setSelectedIngredient(ingredient);
        setName(ingredient.name);
        setSuggestions([]);
        if (ingredient.categoryId) setSelectedCategory(ingredient.categoryId);
    };

    const handleSubmit = async () => {
        if (!name.trim() || submitting) return;
        setSubmitting(true);
        try {
            await onAddItem({
                ingredientId: selectedIngredient?.id,
                nameCustom: selectedIngredient ? undefined : name.trim(),
                categoryId: selectedCategory,
                quantity: parseFloat(quantity) || 1,
                unitId: unitId ?? undefined,
                notes: notes.trim() || undefined,
            });
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    const canAdd = name.trim().length > 0 && !submitting;
    const showAddAsNewRow = name.trim().length >= 2 && !selectedIngredient;
    const getCategoryName = (categoryId: string) => {
        const cat = categories.find(c => c.id === categoryId);
        return cat ? getLocalizedCategoryName(cat) : '';
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background-primary" style={{ paddingTop: insets.top }}>
                <View className="flex-row items-center justify-between px-lg py-md border-b border-grey-lightest">
                    <TouchableOpacity onPress={onClose}><Text preset="body" className="text-primary-dark">{i18n.t('common.cancel')}</Text></TouchableOpacity>
                    <Text preset="h3">{i18n.t('shoppingList.addItem')}</Text>
                    <TouchableOpacity onPress={handleSubmit} disabled={!canAdd}>
                        {submitting ? (
                            <ActivityIndicator size="small" color={COLORS.primary.darkest} />
                        ) : (
                            <Text preset="body" className={canAdd ? 'text-primary-dark font-medium' : 'text-grey-medium'}>
                                {i18n.t('common.done')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                <Pressable onPress={Keyboard.dismiss} className="flex-1">
                    <View className="px-lg pt-md">
                        <View className="flex-row items-center">
                            {/* When the user picks a canonical ingredient, show its image
                                next to the input so they see the match they made. */}
                            {selectedIngredient?.pictureUrl && (
                                <Image
                                    source={{ uri: selectedIngredient.pictureUrl }}
                                    style={{ width: 40, height: 40, borderRadius: 8, marginRight: 8 }}
                                    contentFit="cover"
                                />
                            )}
                            <TextInput
                                value={name}
                                onChangeText={handleNameChange}
                                placeholder={i18n.t('shoppingList.itemNamePlaceholder')}
                                placeholderTextColor={COLORS.grey.medium}
                                className="flex-1 bg-grey-lightest rounded-xl px-md py-md text-text-default text-base"
                                autoFocus
                                returnKeyType="done"
                                blurOnSubmit
                                onSubmitEditing={Keyboard.dismiss}
                            />
                        </View>
                    </View>

                    {/* Suggestions area: canonical ingredient matches + "+ Add as new" affordance. */}
                    {(showAddAsNewRow || suggestions.length > 0) && (
                        <View className="mx-lg mt-xs border border-grey-lightest rounded-xl bg-neutral-white max-h-56">
                            {showAddAsNewRow && (
                                <TouchableOpacity
                                    onPress={() => {
                                        // Submit the typed name as a custom item directly —
                                        // user shouldn't have to tap Done after this.
                                        Keyboard.dismiss();
                                        void handleSubmit();
                                    }}
                                    className="flex-row items-center py-sm px-md border-b border-grey-lightest"
                                >
                                    <View className="w-10 h-10 rounded-lg mr-md bg-primary-lightest items-center justify-center">
                                        <Ionicons name="add" size={20} color={COLORS.primary.darkest} />
                                    </View>
                                    <Text preset="body" className="text-text-default flex-1" numberOfLines={1}>
                                        {i18n.t('shoppingList.addAsNew', { query: name.trim() })}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <FlatList
                                data={suggestions}
                                keyExtractor={(item) => item.id}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => handleSelectIngredient(item)}
                                        className="flex-row items-center py-sm px-md border-b border-grey-lightest"
                                    >
                                        {item.pictureUrl ? (
                                            <Image source={{ uri: item.pictureUrl }} className="w-10 h-10 rounded-lg mr-md" contentFit="cover" />
                                        ) : (
                                            <View className="w-10 h-10 rounded-lg mr-md bg-grey-lightest items-center justify-center">
                                                <Ionicons name="cube-outline" size={20} color={COLORS.grey.medium} />
                                            </View>
                                        )}
                                        <Text preset="body" className="text-text-default">{item.name}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    )}

                    <View className="px-lg py-md">
                        {/* Quantity stepper + unit dropdown */}
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
                            <View className="flex-row flex-wrap gap-sm">
                                {categories.map(cat => (
                                    <TouchableOpacity key={cat.id} onPress={() => setSelectedCategory(cat.id)} className={`px-md py-sm rounded-xl ${selectedCategory === cat.id ? 'bg-primary-medium' : 'bg-grey-lightest'}`}>
                                        <Text preset="caption" className={selectedCategory === cat.id ? 'text-text-default' : 'text-text-secondary'}>{getCategoryName(cat.id)}</Text>
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
                    </View>
                </Pressable>

                {/* Hide the bottom Button while the keyboard is up — it
                    overlaps the category chips with a transparent background.
                    The header "Done" still submits in this state. */}
                {!isKeyboardOpen && (
                    <View className="px-lg bg-background-primary" style={{ paddingBottom: insets.bottom + 16 }}>
                        <Button onPress={handleSubmit} disabled={!canAdd} fullWidth>
                            {submitting ? i18n.t('shoppingList.adding') : i18n.t('shoppingList.addItem')}
                        </Button>
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default AddItemModal;

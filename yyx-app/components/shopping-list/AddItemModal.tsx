import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Modal, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Text, Button } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { shoppingListService } from '@/services/shoppingListService';
import { IngredientSuggestion, ShoppingCategory } from '@/types/shopping-list.types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AddItemModalProps {
    visible: boolean;
    onClose: () => void;
    onAddItem: (item: { ingredientId?: string; nameCustom?: string; categoryId: string; quantity: number; unitId?: string; notes?: string; }) => void;
    categories: ShoppingCategory[];
}

export function AddItemModal({ visible, onClose, onAddItem, categories }: AddItemModalProps) {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
    const [selectedIngredient, setSelectedIngredient] = useState<IngredientSuggestion | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [selectedCategory, setSelectedCategory] = useState<string>('other');
    const [notes, setNotes] = useState('');
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRequestIdRef = useRef(0);

    useEffect(() => {
        if (!visible) {
            setSearchQuery('');
            setSuggestions([]);
            setSelectedIngredient(null);
            setQuantity('1');
            setSelectedCategory('other');
            setNotes('');
        }
    }, [visible]);

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
        setSelectedIngredient(null);
        if (query.length < 2) {
            setSuggestions([]);
        }
    }, []);

    useEffect(() => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        const trimmed = searchQuery.trim();
        if (trimmed.length < 2) {
            return;
        }

        searchDebounceRef.current = setTimeout(async () => {
            const requestId = ++searchRequestIdRef.current;
            try {
                const results = await shoppingListService.searchIngredients(trimmed);
                if (requestId === searchRequestIdRef.current) {
                    setSuggestions(results);
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        }, 300);

        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
            }
        };
    }, [searchQuery]);

    const handleSelectIngredient = (ingredient: IngredientSuggestion) => {
        setSelectedIngredient(ingredient);
        setSearchQuery(ingredient.name);
        setSuggestions([]);
        if (ingredient.categoryId) setSelectedCategory(ingredient.categoryId);
    };

    const handleAddItem = () => {
        const qty = parseFloat(quantity) || 1;
        onAddItem({
            ingredientId: selectedIngredient?.id,
            nameCustom: selectedIngredient ? undefined : searchQuery,
            categoryId: selectedCategory,
            quantity: qty,
            notes: notes.trim() || undefined,
        });
        onClose();
    };

    const canAdd = searchQuery.trim().length > 0;
    const getCategoryName = (categoryId: string) => {
        const cat = categories.find(c => c.id === categoryId);
        return cat ? (i18n.locale === 'es' ? cat.nameEs : cat.nameEn) : '';
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background-primary" style={{ paddingTop: insets.top }}>
                <View className="flex-row items-center justify-between px-lg py-md border-b border-grey-lightest">
                    <TouchableOpacity onPress={onClose}><Text preset="body" className="text-primary-dark">{i18n.t('common.cancel')}</Text></TouchableOpacity>
                    <Text preset="h3">{i18n.t('shoppingList.addItem')}</Text>
                    <TouchableOpacity onPress={handleAddItem} disabled={!canAdd}>
                        <Text preset="body" className={canAdd ? 'text-primary-dark font-medium' : 'text-grey-medium'}>{i18n.t('common.done')}</Text>
                    </TouchableOpacity>
                </View>

                <View className="px-lg py-md">
                    <View className="flex-row items-center bg-grey-lightest rounded-xl px-md">
                        <Ionicons name="search" size={20} color={COLORS.grey.medium} />
                        <TextInput value={searchQuery} onChangeText={handleSearch} placeholder={i18n.t('shoppingList.searchItems')} placeholderTextColor={COLORS.grey.medium} className="flex-1 py-md px-sm text-text-default text-base" autoFocus returnKeyType="done" />
                        {searchQuery.length > 0 && <TouchableOpacity onPress={() => handleSearch('')}><Ionicons name="close-circle" size={20} color={COLORS.grey.medium} /></TouchableOpacity>}
                    </View>
                </View>

                {suggestions.length > 0 && !selectedIngredient && (
                    <FlatList data={suggestions} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" className="max-h-48 mx-lg border border-grey-lightest rounded-xl bg-neutral-white"
                        renderItem={({ item }) => (
                            <TouchableOpacity onPress={() => handleSelectIngredient(item)} className="flex-row items-center py-sm px-md border-b border-grey-lightest">
                                {item.pictureUrl ? <Image source={{ uri: item.pictureUrl }} className="w-10 h-10 rounded-lg mr-md" contentFit="cover" /> : <View className="w-10 h-10 rounded-lg mr-md bg-grey-lightest items-center justify-center"><Ionicons name="cube-outline" size={20} color={COLORS.grey.medium} /></View>}
                                <Text preset="body" className="text-text-default">{item.name}</Text>
                            </TouchableOpacity>
                        )}
                    />
                )}

                <View className="px-lg py-md">
                    <View className="mb-md">
                        <Text preset="caption" className="text-text-secondary mb-xs">{i18n.t('shoppingList.item.quantity')}</Text>
                        {/* Quantity Shortcuts */}
                        <View className="flex-row flex-wrap gap-xs mb-sm">
                            {[1, 2, 3, 4, 6, 12].map(qty => (
                                <TouchableOpacity
                                    key={qty}
                                    onPress={() => setQuantity(String(qty))}
                                    className={`px-md py-xs rounded-full ${parseFloat(quantity) === qty ? 'bg-primary-medium' : 'bg-grey-lightest'}`}
                                >
                                    <Text preset="body" className={parseFloat(quantity) === qty ? 'text-white' : 'text-text-default'}>
                                        {qty}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View className="flex-row items-center">
                            <TouchableOpacity onPress={() => setQuantity(String(Math.max(1, (parseFloat(quantity) || 1) - 1)))} className="w-12 h-12 rounded-xl bg-grey-lightest items-center justify-center"><Ionicons name="remove" size={24} color={COLORS.text.default} /></TouchableOpacity>
                            <TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" className="w-20 h-12 mx-sm text-center text-xl font-medium text-text-default bg-grey-lightest rounded-xl" />
                            <TouchableOpacity onPress={() => setQuantity(String((parseFloat(quantity) || 0) + 1))} className="w-12 h-12 rounded-xl bg-grey-lightest items-center justify-center"><Ionicons name="add" size={24} color={COLORS.text.default} /></TouchableOpacity>
                        </View>
                    </View>

                    <View className="mb-md">
                        <Text preset="caption" className="text-text-secondary mb-xs">{i18n.t('shoppingList.item.category')}</Text>
                        <View className="flex-row flex-wrap">
                            {categories.map(cat => (
                                <TouchableOpacity key={cat.id} onPress={() => setSelectedCategory(cat.id)} className={`px-md py-sm rounded-xl mr-xs mb-xs ${selectedCategory === cat.id ? 'bg-primary-medium' : 'bg-grey-lightest'}`}>
                                    <Text preset="caption" className={selectedCategory === cat.id ? 'text-text-default' : 'text-text-secondary'}>{getCategoryName(cat.id)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View className="mb-md">
                        <Text preset="caption" className="text-text-secondary mb-xs">{i18n.t('shoppingList.item.notes')}</Text>
                        <TextInput value={notes} onChangeText={setNotes} placeholder={i18n.t('shoppingList.item.notesPlaceholder')} placeholderTextColor={COLORS.grey.medium} className="bg-grey-lightest rounded-xl px-md py-md text-text-default text-base" multiline numberOfLines={2} />
                    </View>
                </View>

                <View className="px-lg mt-auto mb-lg" style={{ paddingBottom: insets.bottom }}>
                    <Button onPress={handleAddItem} disabled={!canAdd} fullWidth>{i18n.t('shoppingList.addItem')}</Button>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default AddItemModal;

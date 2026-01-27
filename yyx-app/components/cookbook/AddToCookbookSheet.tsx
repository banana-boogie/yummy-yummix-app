import React, { useState, useEffect } from 'react';
import { View, Modal, Pressable, FlatList, Alert } from 'react-native';
import { Text, Button, TextInput } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { Cookbook, CreateCookbookInput, UpdateCookbookInput } from '@/types/cookbook.types';
import {
    useUserCookbooksQuery,
    useAddRecipeToCookbook,
    useCreateCookbook,
} from '@/hooks/useCookbookQuery';
import { cookbookService } from '@/services/cookbookService';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';
import { CreateEditCookbookModal } from './CreateEditCookbookModal';

interface AddToCookbookSheetProps {
    visible: boolean;
    onClose: () => void;
    recipeId: string;
    recipeName: string;
    onSuccess?: () => void;
}

export function AddToCookbookSheet({
    visible,
    onClose,
    recipeId,
    recipeName,
    onSuccess,
}: AddToCookbookSheetProps) {
    const { user } = useAuth();
    const { data: cookbooks = [], isLoading } = useUserCookbooksQuery();
    const addRecipeMutation = useAddRecipeToCookbook();
    const createCookbookMutation = useCreateCookbook();

    const [selectedCookbook, setSelectedCookbook] = useState<Cookbook | null>(null);
    const [notes, setNotes] = useState('');
    const [step, setStep] = useState<'select' | 'notes'>('select');
    const [cookbookIdsWithRecipe, setCookbookIdsWithRecipe] = useState<string[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Fetch which cookbooks already contain this recipe
    useEffect(() => {
        let cancelled = false;

        if (visible && user?.id && recipeId) {
            cookbookService
                .getCookbookIdsContainingRecipe(user.id, recipeId)
                .then((ids) => {
                    if (!cancelled) setCookbookIdsWithRecipe(ids);
                })
                .catch(() => {
                    if (!cancelled) setCookbookIdsWithRecipe([]);
                });
        }

        return () => {
            cancelled = true;
        };
    }, [visible, user?.id, recipeId]);

    // Reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setSelectedCookbook(null);
            setNotes('');
            setStep('select');
            setCookbookIdsWithRecipe([]);
            setShowCreateModal(false);
        }
    }, [visible]);

    const handleSelectCookbook = async (cookbook: Cookbook) => {
        // Don't allow selecting cookbooks that already have this recipe
        if (cookbookIdsWithRecipe.includes(cookbook.id)) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }
        await Haptics.selectionAsync();
        setSelectedCookbook(cookbook);
        setStep('notes');
    };

    const handleSave = async () => {
        if (!selectedCookbook) return;

        try {
            await addRecipeMutation.mutateAsync({
                cookbookId: selectedCookbook.id,
                recipeId,
                notesEn: notes.trim() || undefined,
            });
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSuccess?.();
            onClose();
        } catch (error) {
            const err = error as Error;
            console.error('Failed to add recipe:', err.message);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            // Handle specific error for duplicate recipe
            const errorMessage =
                err.message === 'RECIPE_ALREADY_ADDED'
                    ? i18n.t('cookbooks.errors.recipeAlreadyAdded')
                    : err.message || i18n.t('cookbooks.errors.addRecipeFailed');
            Alert.alert(i18n.t('common.errors.title'), errorMessage);
        }
    };

    const handleBack = () => {
        setStep('select');
        setSelectedCookbook(null);
    };

    const handleCreateCookbook = async (
        input: CreateCookbookInput | UpdateCookbookInput
    ) => {
        try {
            const created = await createCookbookMutation.mutateAsync(
                input as CreateCookbookInput
            );
            setShowCreateModal(false);
            setSelectedCookbook(created);
            setNotes('');
            setStep('notes');
        } catch (error) {
            const err = error as Error;
            console.error('Failed to create cookbook:', err.message);
            Alert.alert(
                i18n.t('common.errors.title'),
                err.message || i18n.t('cookbooks.errors.createFailed')
            );
        }
    };

    const renderCookbookItem = ({ item }: { item: Cookbook }) => {
        const alreadyHasRecipe = cookbookIdsWithRecipe.includes(item.id);

        return (
            <Pressable
                onPress={() => handleSelectCookbook(item)}
                disabled={alreadyHasRecipe}
                className={`flex-row items-center p-md bg-white rounded-md mb-sm border border-neutral-100 ${
                    alreadyHasRecipe ? 'opacity-60' : 'active:bg-neutral-100'
                }`}
            >
                <Ionicons
                    name={item.isDefault ? 'heart' : 'book-outline'}
                    size={24}
                    color={item.isDefault ? '#D83A3A' : '#666'}
                />
                <View className="flex-1 ml-md">
                    <Text preset="subheading">{item.name}</Text>
                    <Text preset="caption" className="text-text-secondary">
                        {item.recipeCount}{' '}
                        {item.recipeCount === 1
                            ? i18n.t('cookbooks.recipe')
                            : i18n.t('cookbooks.recipes')}
                    </Text>
                </View>
                {alreadyHasRecipe ? (
                    <Ionicons name="checkmark-circle" size={24} color="#78A97A" />
                ) : (
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                )}
            </Pressable>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-primary-lightest rounded-t-xl p-lg max-h-[70%]">
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-md">
                        {step === 'notes' && (
                            <Pressable onPress={handleBack} className="p-xs">
                                <Ionicons name="arrow-back" size={24} color="#2D2D2D" />
                            </Pressable>
                        )}
                        <Text preset="h2" className="flex-1 ml-sm">
                            {step === 'select'
                                ? i18n.t('cookbooks.saveTo')
                                : i18n.t('cookbooks.addNotes')}
                        </Text>
                        <Pressable onPress={onClose} className="p-xs">
                            <Ionicons name="close" size={24} color="#2D2D2D" />
                        </Pressable>
                    </View>

                    {step === 'select' ? (
                        <>
                            {/* Recipe being saved */}
                            <View className="bg-white/60 rounded-md p-sm mb-md">
                                <Text preset="caption" className="text-text-secondary">
                                    {i18n.t('cookbooks.saving')}:
                                </Text>
                                <Text preset="subheading" numberOfLines={1}>
                                    {recipeName}
                                </Text>
                            </View>

                            {/* Cookbook list */}
                            {isLoading ? (
                                <View className="items-center justify-center p-xl">
                                    <Text preset="body" className="text-text-secondary">
                                        {i18n.t('common.loading')}
                                    </Text>
                                </View>
                            ) : cookbooks.length === 0 ? (
                                <View className="items-center justify-center p-xl">
                                    <Ionicons name="book-outline" size={48} color="#ccc" />
                                    <Text preset="body" className="text-text-secondary mt-md text-center">
                                        {i18n.t('cookbooks.noCookbooksYet')}
                                    </Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={cookbooks}
                                    renderItem={renderCookbookItem}
                                    keyExtractor={(item) => item.id}
                                    showsVerticalScrollIndicator={false}
                                />
                            )}

                            <View className="mt-sm">
                                <Button
                                    variant="outline"
                                    onPress={() => setShowCreateModal(true)}
                                    icon={<Ionicons name="add" size={18} color="#2D2D2D" />}
                                >
                                    {i18n.t('cookbooks.createCookbook')}
                                </Button>
                            </View>
                        </>
                    ) : (
                        <>
                            {/* Notes step */}
                            <View className="bg-white/60 rounded-md p-sm mb-md">
                                <Text preset="caption" className="text-text-secondary">
                                    {i18n.t('cookbooks.addingTo')}: {selectedCookbook?.name}
                                </Text>
                            </View>

                            <View className="mb-lg">
                                <Text preset="subheading" className="mb-xs">
                                    {i18n.t('cookbooks.personalNotes')}
                                </Text>
                                <Text preset="caption" className="text-text-secondary mb-sm">
                                    {i18n.t('cookbooks.notesDescription')}
                                </Text>
                                <TextInput
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder={i18n.t('cookbooks.notesPlaceholder')}
                                    className="bg-white rounded-md p-md border border-neutral-200"
                                    multiline
                                    numberOfLines={4}
                                    maxLength={300}
                                />
                            </View>

                            {/* Actions */}
                            <View className="flex-row gap-md">
                                <Button
                                    variant="secondary"
                                    onPress={handleBack}
                                    className="flex-1"
                                >
                                    {i18n.t('common.back')}
                                </Button>
                                <Button
                                    variant="primary"
                                    onPress={handleSave}
                                    disabled={addRecipeMutation.isPending}
                                    className="flex-1"
                                >
                                    {addRecipeMutation.isPending
                                        ? i18n.t('common.saving')
                                        : i18n.t('cookbooks.addRecipe')}
                                </Button>
                            </View>

                            <View className="h-8" />
                        </>
                    )}
                </View>
            </View>
        </Modal>

        <CreateEditCookbookModal
            visible={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSave={handleCreateCookbook}
            isLoading={createCookbookMutation.isPending}
        />
    );
}

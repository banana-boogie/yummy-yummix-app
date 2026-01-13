import React, { useState } from 'react';
import { v4 as generateUUID } from 'uuid';
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/form/TextInput';
import { FORM_MAX_WIDTH } from '@/components/form/FormSection';
import { AdminRecipe, AdminIngredient, AdminRecipeTag, AdminRecipeIngredient, AdminUsefulItem, AdminRecipeUsefulItem } from '@/types/recipe.admin.types';
import { parseRecipeMarkdown } from '@/services/admin/markdownRecipeParserService';
import { CreateEditIngredientModal } from '@/components/admin/ingredients/CreateEditIngredientModal';
import { TagEditModal } from '@/components/admin/tags/TagEditModal';
import i18n from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import { CreateEditUsefulItemModal } from '../useful-items/CreateEditUsefulItemModal';
import { CheckboxButton } from '@/components/common/CheckboxButton';
import { COLORS } from '@/constants/design-tokens';

interface InitialRecipeStepProps {
    onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
    handleNextStep: () => void;
    recipe: Partial<AdminRecipe>;
}

export function InitialRecipeStep({ onUpdateRecipe, handleNextStep, recipe }: InitialRecipeStepProps) {
    const [showMarkdownImport, setShowMarkdownImport] = useState(false);
    const [markdownText, setMarkdownText] = useState('');
    const [importSuccessful, setImportSuccessful] = useState(false);
    const [parsingStatus, setParsingStatus] = useState<{
        loading: boolean;
        error?: string;
        missingIngredients?: Array<AdminRecipeIngredient>;
        missingTags?: string[];
        missingUsefulItems?: string[];
    }>({ loading: false });
    const [showIngredientModal, setShowIngredientModal] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);
    const [showUsefulItemModal, setShowUsefulItemModal] = useState(false);

    // State to track checked ingredients and tags
    const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
    const [checkedTags, setCheckedTags] = useState<Record<string, boolean>>({});
    const [checkedUsefulItems, setCheckedUsefulItems] = useState<Record<string, boolean>>({});

    // Toggle ingredient checked state
    const toggleIngredientChecked = (ingredientId: string) => {
        setCheckedIngredients(prev => ({
            ...prev,
            [ingredientId]: !prev[ingredientId]
        }));
    };

    // Toggle tag checked state
    const toggleTagChecked = (tag: string) => {
        setCheckedTags(prev => ({
            ...prev,
            [tag]: !prev[tag]
        }));
    };

    // Toggle useful item checked state
    const toggleUsefulItemChecked = (usefulItemId: string) => {
        setCheckedUsefulItems(prev => ({
            ...prev,
            [usefulItemId]: !prev[usefulItemId]
        }));
    };

    // Handler for importing markdown
    const handleImportMarkdown = async () => {
        if (!markdownText.trim()) return;

        setParsingStatus({ loading: true });
        // Reset checked states when importing
        setCheckedIngredients({});
        setCheckedTags({});
        setCheckedUsefulItems({});
        try {
            const { recipe: parsedRecipe, missingIngredients, missingTags, missingUsefulItems } = await parseRecipeMarkdown(markdownText);

            // Update the recipe state with parsed data
            onUpdateRecipe(parsedRecipe);

            setParsingStatus({
                loading: false,
                missingIngredients,
                missingTags,
                missingUsefulItems
            });

            // Proceed to the next step if there are no missing ingredients, tags or useful items
            if (!missingIngredients?.length && !missingTags?.length && !missingUsefulItems?.length) {
                handleNextStep();
            } else {
                setImportSuccessful(true);
            }
        } catch (error) {
            setParsingStatus({
                loading: false,
                error: error instanceof Error ? error.message : 'Failed to parse recipe'
            });
        }
    };

    // Handle newly created ingredient
    const handleIngredientSaved = (newIngredient: AdminIngredient) => {
        setShowIngredientModal(false);

        const isIngredientMatch = (recipeIngredient: AdminRecipeIngredient, newIngredient: AdminIngredient) => {
            return (
                recipeIngredient.ingredient?.nameEn?.toLowerCase() === newIngredient.nameEn.toLowerCase() ||
                recipeIngredient.ingredient?.pluralNameEn?.toLowerCase() === newIngredient.pluralNameEn.toLowerCase() ||
                recipeIngredient.ingredient?.nameEs?.toLowerCase() === newIngredient.nameEs.toLowerCase() ||
                recipeIngredient.ingredient?.pluralNameEs?.toLowerCase() === newIngredient.pluralNameEs.toLowerCase()
            );
        };

        const matchingMissingIngredient = parsingStatus.missingIngredients?.find(
            recipeIngredient => isIngredientMatch(recipeIngredient, newIngredient)
        );

        // If there's a match, mark it as checked in the UI
        if (matchingMissingIngredient) {
            // Find the index of the matching ingredient
            const matchingIndex = parsingStatus.missingIngredients?.findIndex(
                recipeIngredient => isIngredientMatch(recipeIngredient, newIngredient)
            );

            if (matchingIndex !== -1) {
                // Update the checked state for this ingredient
                setCheckedIngredients(prev => ({
                    ...prev,
                    [`ingredient-${matchingIndex}`]: true
                }));
            }
        }

        // Update recipe ingredients
        const updatedRecipe = { ...recipe };
        if (!updatedRecipe.ingredients) {
            updatedRecipe.ingredients = [];
        }

        // If we have a matching missing ingredient, merge its data with the new ingredient
        if (matchingMissingIngredient) {
            const mergedIngredient: AdminRecipeIngredient = {
                ...matchingMissingIngredient,
                ingredient: newIngredient,
                ingredientId: newIngredient.id,
            };

            // Add the merged ingredient to the recipe
            updatedRecipe.ingredients.push(mergedIngredient);
        }

        onUpdateRecipe(updatedRecipe);
    };

    // Handle newly created tag
    const handleTagSaved = (newTag: AdminRecipeTag) => {
        setShowTagModal(false);

        // Find matching missing tag
        const matchingIndex = parsingStatus.missingTags?.findIndex(
            tag => tag.toLowerCase() === newTag.nameEn.toLowerCase() ||
                tag.toLowerCase() === newTag.nameEs.toLowerCase()
        );

        // If there's a match, mark it as checked in the UI
        if (matchingIndex !== -1) {
            // Update the checked state for this tag
            setCheckedTags(prev => ({
                ...prev,
                [`tag-${matchingIndex}`]: true
            }));
        }

        // Add tag to the recipe with Map-based deduplication
        const updatedRecipe = { ...recipe };
        if (!updatedRecipe.tags) {
            updatedRecipe.tags = [];
        }

        // Create a Map from existing tags and add the new tag
        // This automatically handles deduplication by ID
        const tagsMap = new Map(
            updatedRecipe.tags.map(tag => [tag.id, tag])
        );

        // Add or update the new tag
        tagsMap.set(newTag.id, newTag);

        // Convert back to array
        updatedRecipe.tags = Array.from(tagsMap.values());

        onUpdateRecipe(updatedRecipe);
    };

    // Handle newly created useful item
    const handleUsefulItemSaved = (newUsefulItem: AdminUsefulItem) => {
        setShowUsefulItemModal(false);

        // Find matching missing useful item
        const matchingIndex = parsingStatus.missingUsefulItems?.findIndex(
            usefulItem => usefulItem.toLowerCase() === newUsefulItem.nameEn.toLowerCase() ||
                usefulItem.toLowerCase() === newUsefulItem.nameEs.toLowerCase()
        );

        // If there's a match, mark it as checked in the UI
        if (matchingIndex !== -1) {
            // Update the checked state for this useful item
            setCheckedUsefulItems(prev => ({
                ...prev,
                [`usefulItem-${matchingIndex}`]: true
            }));
        }

        const mergedUsefulItem: AdminRecipeUsefulItem = {
            id: `temp-${generateUUID()}`, // Ensure recipeUsefulItem has an id
            recipeId: `temp-recipe-id`, // Ensure recipeUsefulItem has a recipeId
            usefulItemId: newUsefulItem.id,
            displayOrder: 0,
            usefulItem: newUsefulItem
        };

        const updatedRecipe = { ...recipe };
        if (!updatedRecipe.usefulItems) {
            updatedRecipe.usefulItems = [];
        }

        // Add the merged useful item to the recipe
        updatedRecipe.usefulItems.push(mergedUsefulItem);

        onUpdateRecipe(updatedRecipe);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 w-full items-center justify-center p-xl"
        >
            {!showMarkdownImport ? (
                // Initial options screen
                <View className="w-full items-center" style={{ maxWidth: FORM_MAX_WIDTH }}>
                    <Text preset="h1" className="mb-md text-center">
                        {i18n.t('admin.recipes.create.getStarted')}
                    </Text>

                    <Text className="mb-xl text-center">
                        {i18n.t('admin.recipes.create.chooseOption')}
                    </Text>

                    <View className="w-full items-center">
                        <Button
                            label={i18n.t('admin.recipes.create.populateWithAI')}
                            variant="primary"
                            icon={<Ionicons name="color-wand-outline" size={24} color={COLORS.neutral.WHITE} className="mr-xs" />}
                            onPress={() => setShowMarkdownImport(true)}
                            className="w-full max-w-[400px] mb-lg"
                        />

                        <Button
                            label={i18n.t('admin.recipes.create.startFromScratch')}
                            icon={<Ionicons name="create-outline" size={24} color={COLORS.text.DEFAULT} className="mr-xxs" />}
                            variant="outline"
                            onPress={handleNextStep}
                            className="w-full max-w-[400px] mb-lg"
                        />

                        <Button
                            label={i18n.t('admin.recipes.form.initialSetup.continueRecipe')}
                            icon={<Ionicons name="arrow-forward-outline" size={24} color={COLORS.text.DEFAULT} className="mr-xxs" />}
                            variant="outline"
                            onPress={handleNextStep}
                            className="w-full max-w-[400px] mb-lg"
                        />
                    </View>
                </View>
            ) : (
                // Markdown import section (previously in modal)
                <View className="w-full" style={{ maxWidth: FORM_MAX_WIDTH }}>
                    <Text preset="h1" className="mb-md text-center">
                        {i18n.t('admin.recipes.form.initialSetup.populateRecipe')}
                    </Text>

                    <ScrollView className="max-h-[500px] mb-md">
                        {!importSuccessful && (
                            <View className="relative">
                                <TextInput
                                    multiline
                                    numberOfLines={20}
                                    value={markdownText}
                                    onChangeText={setMarkdownText}
                                    placeholder={i18n.t('admin.recipes.form.initialSetup.pasteHere')}
                                    className="w-full max-h-[250px] p-sm border border-border-DEFAULT rounded mb-md"
                                    style={{ textAlignVertical: 'top' }}
                                    editable={!parsingStatus.loading}
                                />
                                {parsingStatus.loading && (
                                    <View className="absolute inset-0 bg-white/80 justify-center items-center rounded">
                                        <ActivityIndicator size="large" color={COLORS.primary.DARKEST} />
                                    </View>
                                )}
                            </View>
                        )}

                        {parsingStatus.error && (
                            <View className="mt-md p-sm bg-status-ERROR rounded">
                                <Text className="color-white">{parsingStatus.error}</Text>
                            </View>
                        )}

                        {(parsingStatus.missingIngredients?.length || parsingStatus.missingTags?.length || parsingStatus.missingUsefulItems?.length) ? (
                            <View className="mt-md p-md bg-primary-LIGHT rounded border border-primary-MEDIUM">
                                {parsingStatus.missingIngredients && parsingStatus.missingIngredients?.length > 0 ? (
                                    <View className="mb-md bg-background-DEFAULT rounded overflow-hidden border border-border-DEFAULT">
                                        <View className="flex-row justify-between items-center p-sm bg-background-SECONDARY border-b border-border-DEFAULT">
                                            <Text className="font-bold text-text-DEFAULT flex-1">
                                                {i18n.t('admin.recipes.form.initialSetup.missingIngredients')}
                                            </Text>
                                            <Button
                                                label={i18n.t('admin.recipes.form.initialSetup.createIngredient')}
                                                variant="outline"
                                                size="small"
                                                onPress={() => setShowIngredientModal(true)}
                                                className="ml-sm"
                                            />
                                        </View>
                                        <View className="p-sm">
                                            {parsingStatus.missingIngredients.map((recipeIngredient, index) => {
                                                const ingredientId = `ingredient-${index}`;
                                                const isChecked = checkedIngredients[ingredientId] || false;

                                                return (
                                                    <CheckboxButton
                                                        key={index}
                                                        checked={isChecked}
                                                        onPress={() => toggleIngredientChecked(ingredientId)}
                                                        // @ts-ignore - recipeIngredient from 
                                                        label={`${recipeIngredient.ingredient?.nameEn || ''} / ${recipeIngredient.ingredient?.nameEs || ''}`}
                                                        className="flex-row items-center mb-xs py-xxs"
                                                    />
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : null}

                                {parsingStatus.missingTags && parsingStatus.missingTags.length > 0 ? (
                                    <View className="mb-md bg-background-DEFAULT rounded overflow-hidden border border-border-DEFAULT">
                                        <View className="flex-row justify-between items-center p-sm bg-background-SECONDARY border-b border-border-DEFAULT">
                                            <Text className="font-bold text-text-DEFAULT flex-1">
                                                {i18n.t('admin.recipes.form.initialSetup.missingTags')}
                                            </Text>
                                            <Button
                                                label={i18n.t('admin.recipes.form.initialSetup.createTag')}
                                                variant="outline"
                                                size="small"
                                                onPress={() => setShowTagModal(true)}
                                                className="ml-sm"
                                            />
                                        </View>
                                        <View className="p-sm">
                                            {parsingStatus.missingTags.map((tag, index) => {
                                                const tagId = `tag-${index}`;
                                                const isChecked = checkedTags[tagId] || false;

                                                return (
                                                    <CheckboxButton
                                                        key={index}
                                                        checked={isChecked}
                                                        onPress={() => toggleTagChecked(tagId)}
                                                        label={tag}
                                                        className="flex-row items-center mb-xs py-xxs"
                                                    />
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : null}

                                {parsingStatus.missingUsefulItems && parsingStatus.missingUsefulItems.length > 0 ? (
                                    <View className="mb-md bg-background-DEFAULT rounded overflow-hidden border border-border-DEFAULT">
                                        <View className="flex-row justify-between items-center p-sm bg-background-SECONDARY border-b border-border-DEFAULT">
                                            <Text className="font-bold text-text-DEFAULT flex-1">
                                                {i18n.t('admin.recipes.form.initialSetup.missingUsefulItems')}
                                            </Text>
                                            <Button
                                                label={i18n.t('admin.recipes.form.initialSetup.createUsefulItem')}
                                                variant="outline"
                                                size="small"
                                                onPress={() => setShowUsefulItemModal(true)}
                                                className="ml-sm"
                                            />
                                        </View>
                                        <View className="p-sm">
                                            {parsingStatus.missingUsefulItems.map((usefulItem, index) => {
                                                const usefulItemId = `usefulItem-${index}`;
                                                const isChecked = checkedUsefulItems[usefulItemId] || false;

                                                return (
                                                    <CheckboxButton
                                                        key={index}
                                                        checked={isChecked}
                                                        onPress={() => toggleUsefulItemChecked(usefulItemId)}
                                                        label={usefulItem}
                                                        className="flex-row items-center mb-xs py-xxs"
                                                    />
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : null}

                            </View>
                        ) : null}
                    </ScrollView>

                    <View className="flex-row justify-between mt-md gap-xs">
                        <Button
                            label={i18n.t('common.back')}
                            onPress={() => {
                                setShowMarkdownImport(false);
                                setImportSuccessful(false);
                            }}
                            variant="outline"
                            className="flex-1"
                        />
                        {importSuccessful ? (
                            <Button
                                label={i18n.t('common.next')}
                                onPress={handleNextStep}
                                className="flex-1"
                            />
                        ) : (
                            <Button
                                label={i18n.t('common.import')}
                                onPress={handleImportMarkdown}
                                loading={parsingStatus.loading}
                                className="flex-1"
                                disabled={!markdownText}
                            />
                        )}
                    </View>
                </View>
            )}

            {/* Create Ingredient Modal */}
            <CreateEditIngredientModal
                visible={showIngredientModal}
                onClose={() => setShowIngredientModal(false)}
                onSuccess={handleIngredientSaved}
            />

            {/* Create Tag Modal */}
            <TagEditModal
                visible={showTagModal}
                onClose={() => setShowTagModal(false)}
                onSave={handleTagSaved}
                isNew={true}
            />

            {/* Create Useful Item Modal */}
            <CreateEditUsefulItemModal
                visible={showUsefulItemModal}
                onClose={() => setShowUsefulItemModal(false)}
                onSuccess={handleUsefulItemSaved}
            />
        </KeyboardAvoidingView>
    );
}

import React, { useState } from 'react';
import { v4 as generateUUID } from 'uuid';
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/form/TextInput';
import { FORM_MAX_WIDTH } from '@/components/form/FormSection';
import { AdminRecipe, AdminIngredient, AdminRecipeTag, AdminRecipeIngredient, AdminKitchenTool, AdminRecipeKitchenTool, getTranslatedField } from '@/types/recipe.admin.types';
import { parseRecipeMarkdown } from '@/services/admin/markdownRecipeParserService';
import { CreateEditIngredientModal } from '@/components/admin/ingredients/CreateEditIngredientModal';
import { TagEditModal } from '@/components/admin/tags/TagEditModal';
import i18n from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import { CreateEditKitchenToolModal } from '../kitchen-tools/CreateEditKitchenToolModal';
import { CheckboxButton } from '@/components/common/CheckboxButton';
import { COLORS } from '@/constants/design-tokens';
import { useRecipeTranslation } from '@/hooks/admin/useRecipeTranslation';
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';
import { ExtendedRecipe } from '@/hooks/admin/useAdminRecipeForm';

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
        missingIngredients?: AdminRecipeIngredient[];
        missingTags?: string[];
        missingKitchenTools?: string[];
    }>({ loading: false });
    const [showIngredientModal, setShowIngredientModal] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);
    const [showKitchenToolModal, setShowKitchenToolModal] = useState(false);

    // Locale selection for AI generation
    // includeRegional=true to get es-ES, but filter out es-MX (redundant — 'es' IS Mexican Spanish)
    const { locales: allLocales } = useActiveLocales(true);
    const filteredLocales = allLocales.filter(l => l.code !== 'es-MX');
    const { translating, progress, translateAll } = useRecipeTranslation();
    // The admin-ai-recipe-import edge function generates 'en' + 'es' by default.
    // Additional locales (e.g. es-ES) are translated via translate-content after parsing.
    const PARSE_GENERATED_LOCALES = ['en', 'es'];
    const [selectedLocales, setSelectedLocales] = useState<Record<string, boolean>>({
        en: true,
        es: true,
        'es-ES': true,
    });

    const toggleLocale = (code: string) => {
        setSelectedLocales(prev => ({ ...prev, [code]: !prev[code] }));
    };

    // State to track checked ingredients and tags
    const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
    const [checkedTags, setCheckedTags] = useState<Record<string, boolean>>({});
    const [checkedKitchenTools, setCheckedKitchenTools] = useState<Record<string, boolean>>({});

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

    // Toggle kitchen tool checked state
    const toggleKitchenToolChecked = (kitchenToolId: string) => {
        setCheckedKitchenTools(prev => ({
            ...prev,
            [kitchenToolId]: !prev[kitchenToolId]
        }));
    };

    // Handler for importing markdown
    const handleImportMarkdown = async () => {
        if (!markdownText.trim()) return;

        setParsingStatus({ loading: true });
        // Reset checked states when importing
        setCheckedIngredients({});
        setCheckedTags({});
        setCheckedKitchenTools({});
        try {
            const { recipe: parsedRecipe, missingIngredients, missingTags, missingKitchenTools } = await parseRecipeMarkdown(markdownText);

            // Determine which additional locales need translation
            // admin-ai-recipe-import generates 'en' + 'es'. Any other selected locale needs translate-content.
            const additionalLocales = Object.entries(selectedLocales)
                .filter(([code, checked]) => checked && !PARSE_GENERATED_LOCALES.includes(code))
                .map(([code]) => code);

            let finalRecipe = parsedRecipe;

            // Strip locales the admin unchecked
            if (finalRecipe.translations) {
                finalRecipe = {
                    ...finalRecipe,
                    translations: finalRecipe.translations.filter(
                        t => selectedLocales[t.locale]
                    ),
                };
            }

            // Auto-translate to additional locales (e.g. es-ES) using translate-content
            if (additionalLocales.length > 0) {
                finalRecipe = await translateAll(
                    finalRecipe as ExtendedRecipe,
                    'es', // source is Spanish (Mexican)
                    additionalLocales,
                );
            }

            // Update the recipe state with parsed + translated data
            onUpdateRecipe(finalRecipe);

            setParsingStatus({
                loading: false,
                missingIngredients,
                missingTags,
                missingKitchenTools
            });

            // Proceed to the next step if there are no missing ingredients, tags or kitchen tools
            if (!missingIngredients?.length && !missingTags?.length && !missingKitchenTools?.length) {
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
            const existingNameEn = getTranslatedField(recipeIngredient.ingredient?.translations, 'en', 'name');
            const existingNameEs = getTranslatedField(recipeIngredient.ingredient?.translations, 'es', 'name');
            const existingPluralEn = getTranslatedField(recipeIngredient.ingredient?.translations, 'en', 'pluralName');
            const existingPluralEs = getTranslatedField(recipeIngredient.ingredient?.translations, 'es', 'pluralName');
            const newNameEn = getTranslatedField(newIngredient.translations, 'en', 'name');
            const newNameEs = getTranslatedField(newIngredient.translations, 'es', 'name');
            const newPluralEn = getTranslatedField(newIngredient.translations, 'en', 'pluralName');
            const newPluralEs = getTranslatedField(newIngredient.translations, 'es', 'pluralName');
            return (
                (existingNameEn && newNameEn && existingNameEn.toLowerCase() === newNameEn.toLowerCase()) ||
                (existingPluralEn && newPluralEn && existingPluralEn.toLowerCase() === newPluralEn.toLowerCase()) ||
                (existingNameEs && newNameEs && existingNameEs.toLowerCase() === newNameEs.toLowerCase()) ||
                (existingPluralEs && newPluralEs && existingPluralEs.toLowerCase() === newPluralEs.toLowerCase())
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
        const newTagNameEn = getTranslatedField(newTag.translations, 'en', 'name');
        const newTagNameEs = getTranslatedField(newTag.translations, 'es', 'name');
        const matchingIndex = parsingStatus.missingTags?.findIndex(
            tag => (newTagNameEn && tag.toLowerCase() === newTagNameEn.toLowerCase()) ||
                (newTagNameEs && tag.toLowerCase() === newTagNameEs.toLowerCase())
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

    // Handle newly created kitchen tool
    const handleKitchenToolSaved = (newKitchenTool: AdminKitchenTool) => {
        setShowKitchenToolModal(false);

        // Find matching missing kitchen tool
        const newKitchenToolNameEn = getTranslatedField(newKitchenTool.translations, 'en', 'name');
        const newKitchenToolNameEs = getTranslatedField(newKitchenTool.translations, 'es', 'name');
        const matchingIndex = parsingStatus.missingKitchenTools?.findIndex(
            kitchenTool => (newKitchenToolNameEn && kitchenTool.toLowerCase() === newKitchenToolNameEn.toLowerCase()) ||
                (newKitchenToolNameEs && kitchenTool.toLowerCase() === newKitchenToolNameEs.toLowerCase())
        );

        // If there's a match, mark it as checked in the UI
        if (matchingIndex !== -1) {
            // Update the checked state for this kitchen tool
            setCheckedKitchenTools(prev => ({
                ...prev,
                [`kitchenTool-${matchingIndex}`]: true
            }));
        }

        const mergedKitchenTool: AdminRecipeKitchenTool = {
            id: `temp-${generateUUID()}`, // Ensure recipeKitchenTool has an id
            recipeId: `temp-recipe-id`, // Ensure recipeKitchenTool has a recipeId
            kitchenToolId: newKitchenTool.id,
            displayOrder: 0,
            kitchenTool: newKitchenTool
        };

        const updatedRecipe = { ...recipe };
        if (!updatedRecipe.kitchenTools) {
            updatedRecipe.kitchenTools = [];
        }

        // Add the merged kitchen tool to the recipe
        updatedRecipe.kitchenTools.push(mergedKitchenTool);

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
                        {/* Locale checkboxes */}
                        {!importSuccessful && (
                            <View className="mb-md p-sm bg-background-SECONDARY rounded-md">
                                <Text preset="bodySmall" className="mb-xs font-semibold">
                                    {i18n.t('admin.translate.targetLanguages')}
                                </Text>
                                <View className="flex-row flex-wrap gap-xs">
                                    {filteredLocales.map(locale => (
                                        <CheckboxButton
                                            key={locale.code}
                                            checked={selectedLocales[locale.code] ?? false}
                                            onPress={() => toggleLocale(locale.code)}
                                            label={locale.displayName}
                                            strikethrough={false}
                                            className="flex-row items-center mr-md"
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Translation progress */}
                        {translating && progress && (
                            <View className="mb-md p-sm bg-primary-LIGHT rounded-md border border-primary-MEDIUM">
                                <Text preset="bodySmall" className="mb-xs">
                                    {i18n.t('admin.translate.translating', { defaultValue: 'Translating...' })} {progress.current}/{progress.total}
                                </Text>
                                <View className="h-2 bg-background-DEFAULT rounded-full overflow-hidden">
                                    <View
                                        className="h-full bg-primary-DEFAULT rounded-full"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </View>
                            </View>
                        )}

                        {!importSuccessful && (
                            <View className="relative">
                                <TextInput
                                    multiline
                                    numberOfLines={20}
                                    value={markdownText}
                                    onChangeText={setMarkdownText}
                                    placeholder={i18n.t('admin.recipes.form.initialSetup.pasteHere')}
                                    className="w-full max-h-[250px]"
                                    containerClassName="mb-md"
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

                        {(parsingStatus.missingIngredients?.length || parsingStatus.missingTags?.length || parsingStatus.missingKitchenTools?.length) ? (
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
                                                        label={`${getTranslatedField(recipeIngredient.ingredient?.translations, 'en', 'name') || ''} / ${getTranslatedField(recipeIngredient.ingredient?.translations, 'es', 'name') || ''}`}
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

                                {parsingStatus.missingKitchenTools && parsingStatus.missingKitchenTools.length > 0 ? (
                                    <View className="mb-md bg-background-DEFAULT rounded overflow-hidden border border-border-DEFAULT">
                                        <View className="flex-row justify-between items-center p-sm bg-background-SECONDARY border-b border-border-DEFAULT">
                                            <Text className="font-bold text-text-DEFAULT flex-1">
                                                {i18n.t('admin.recipes.form.initialSetup.missingKitchenTools')}
                                            </Text>
                                            <Button
                                                label={i18n.t('admin.recipes.form.initialSetup.createKitchenTool')}
                                                variant="outline"
                                                size="small"
                                                onPress={() => setShowKitchenToolModal(true)}
                                                className="ml-sm"
                                            />
                                        </View>
                                        <View className="p-sm">
                                            {parsingStatus.missingKitchenTools.map((kitchenTool, index) => {
                                                const kitchenToolId = `kitchenTool-${index}`;
                                                const isChecked = checkedKitchenTools[kitchenToolId] || false;

                                                return (
                                                    <CheckboxButton
                                                        key={index}
                                                        checked={isChecked}
                                                        onPress={() => toggleKitchenToolChecked(kitchenToolId)}
                                                        label={kitchenTool}
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
                                loading={parsingStatus.loading || translating}
                                className="flex-1"
                                disabled={!markdownText || translating}
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

            {/* Create Kitchen Tool Modal */}
            <CreateEditKitchenToolModal
                visible={showKitchenToolModal}
                onClose={() => setShowKitchenToolModal(false)}
                onSuccess={handleKitchenToolSaved}
            />
        </KeyboardAvoidingView>
    );
}

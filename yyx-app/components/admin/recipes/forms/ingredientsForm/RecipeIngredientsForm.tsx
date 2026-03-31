import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Text } from '@/components/common/Text';
import { AdminRecipe, AdminRecipeIngredient, AdminIngredient, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { AdminRecipeIngredientCard } from '@/components/admin/recipes/forms/ingredientsForm/AdminRecipeIngredientCard';
import { adminIngredientsService } from '@/services/admin/adminIngredientsService';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { RecipeIngredientFormModal } from './RecipeIngredientFormModal';
import { SearchBar } from '@/components/common/SearchBar';
import { Image } from 'expo-image';
import { CreateEditIngredientModal } from '@/components/admin/ingredients/CreateEditIngredientModal';
import { Button } from '@/components/common/Button';
import { AlertModal } from '@/components/common/AlertModal';
import { v4 as generateUUID } from 'uuid';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';
import logger from '@/services/logger';

type IngredientsFormProps = {
  recipe: AdminRecipe;
  onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
  errors: Record<string, string>;
  authoringLocale?: string;
  displayLocale?: string;
  missingIngredients?: any[];
};

export function RecipeIngredientsForm({ recipe, onUpdateRecipe, errors, authoringLocale = 'es', displayLocale, missingIngredients }: IngredientsFormProps) {
  const tForm = (key: string, opts?: any) => i18n.t(key, { ...opts, locale: authoringLocale });
  const { isMobile } = useDevice();
  const [ingredients, setIngredients] = useState<AdminIngredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<AdminIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [measurementUnits, setMeasurementUnits] = useState<any[]>([]);
  const [selectedRecipeIngredient, setSelectedRecipeIngredient] = useState<AdminRecipeIngredient>();
  const [modalVisible, setModalVisible] = useState(false);
  const [newIngredientModalVisible, setNewIngredientModalVisible] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rightColHeight, setRightColHeight] = useState<number | undefined>(undefined);
  const isWeb = Platform.OS === 'web';

  // Group ingredients by recipeSection
  const groupedIngredients = recipe.ingredients.reduce<Record<string, AdminRecipeIngredient[]>>((acc, ingredient) => {
    const recipeSection = getTranslatedField(ingredient.translations, authoringLocale, 'recipeSection')
      || '';
    if (!acc[recipeSection]) {
      acc[recipeSection] = [];
    }
    acc[recipeSection].push(ingredient);
    return acc;
  }, {});

  // Sort sections and ingredients by displayOrder
  const sortedSections = Object.entries(groupedIngredients).sort((a, b) => {
    // Sort sections by the minimum displayOrder of their ingredients
    const minOrderA = Math.min(...a[1].map(ing => ing.displayOrder || 0));
    const minOrderB = Math.min(...b[1].map(ing => ing.displayOrder || 0));
    return minOrderA - minOrderB;
  });

  // Fetch all ingredients and measurement units on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [fetchedIngredients, fetchedUnits] = await Promise.all([
          adminIngredientsService.getAllIngredientsForAdmin(),
          adminRecipeService.getAllMeasurementUnits()
        ]);

        setIngredients(fetchedIngredients);
        setFilteredIngredients(fetchedIngredients);

        setMeasurementUnits(fetchedUnits);
      } catch (error) {
        logger.error('Error fetching ingredients:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredIngredients(ingredients);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = ingredients.filter(
      ingredient => ingredient.translations.some(t =>
        t.name?.toLowerCase().includes(query) ||
        t.pluralName?.toLowerCase().includes(query)
      )
    );
    setFilteredIngredients(filtered);
  }, [searchQuery, ingredients]);

  const handleAddRecipeIngredient = (ingredient: AdminIngredient) => {
    // Create a new recipe ingredient from the selected ingredient
    const newRecipeIngredient: AdminRecipeIngredient = {
      id: generateUUID(),
      ingredientId: ingredient.id,
      ingredient,
      quantity: '',
      measurementUnit: {
        id: '',
        type: 'unit',
        system: 'metric',
        translations: [],
      },
      optional: false,
      translations: [
        { locale: 'es', recipeSection: 'Principal' },
        { locale: 'en', recipeSection: 'Main' },
      ],
      displayOrder: recipe.ingredients ? recipe.ingredients.length : 1,
    };

    setSelectedRecipeIngredient(newRecipeIngredient);
    setModalVisible(true);
  };

  const handleEditRecipeIngredient = (ingredient: AdminRecipeIngredient) => {
    setSelectedRecipeIngredient(ingredient);
    setModalVisible(true);
  };

  const handleDeleteRecipeIngredient = (recipeIngredient: AdminRecipeIngredient) => {
    const updatedIngredients = recipe.ingredients.filter(
      ing => ing.id !== recipeIngredient.id
    );

    const reorderedIngredients = updatedIngredients.map((ing, index) => ({
      ...ing,
      displayOrder: index
    }));

    const updatedSteps = (recipe.steps || []).map(instruction => {
      const filteredStepIngredients = (instruction.ingredients || []).filter(
        stepIng => stepIng.id !== recipeIngredient.id
      );

      return {
        ...instruction,
        ingredients: filteredStepIngredients
      };
    });

    onUpdateRecipe({
      ingredients: reorderedIngredients,
      steps: updatedSteps
    });
  };

  const handleSaveRecipeIngredient = (updatedRecipeIngredient: AdminRecipeIngredient) => {
    let updatedRecipeIngredients: AdminRecipeIngredient[];

    const existingIndex = recipe.ingredients.findIndex(
      ing => ing.id === updatedRecipeIngredient.id
    );

    if (existingIndex >= 0) {
      updatedRecipeIngredients = [...recipe.ingredients];
      updatedRecipeIngredients[existingIndex] = updatedRecipeIngredient;
    } else {
      updatedRecipeIngredients = [...recipe.ingredients, updatedRecipeIngredient];
    }

    onUpdateRecipe({ ingredients: updatedRecipeIngredients });
  };

  const handleMoveRecipeIngredientUp = (id: string, sectionName: string) => {
    const sectionIngredients = groupedIngredients[sectionName];
    const sortedSectionIngredients = [...sectionIngredients].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const ingredientIndex = sortedSectionIngredients.findIndex(ing => ing.id === id);

    if (ingredientIndex <= 0) return;

    const allIngredients = [...recipe.ingredients];
    const currentIngredient = sortedSectionIngredients[ingredientIndex];
    const prevIngredient = sortedSectionIngredients[ingredientIndex - 1];

    const currentIndex = allIngredients.findIndex(ing => ing.id === currentIngredient.id);
    const prevIndex = allIngredients.findIndex(ing => ing.id === prevIngredient.id);

    const tempOrder = currentIngredient.displayOrder || 0;
    allIngredients[currentIndex] = {
      ...allIngredients[currentIndex],
      displayOrder: prevIngredient.displayOrder || 0
    };
    allIngredients[prevIndex] = {
      ...allIngredients[prevIndex],
      displayOrder: tempOrder
    };

    onUpdateRecipe({ ingredients: allIngredients });
  };

  const handleMoveRecipeIngredientDown = (id: string, sectionName: string) => {
    const sectionIngredients = groupedIngredients[sectionName];
    const sortedSectionIngredients = [...sectionIngredients].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const ingredientIndex = sortedSectionIngredients.findIndex(ing => ing.id === id);

    if (ingredientIndex >= sortedSectionIngredients.length - 1) return;

    const allIngredients = [...recipe.ingredients];
    const currentIngredient = sortedSectionIngredients[ingredientIndex];
    const nextIngredient = sortedSectionIngredients[ingredientIndex + 1];

    const currentIndex = allIngredients.findIndex(ing => ing.id === currentIngredient.id);
    const nextIndex = allIngredients.findIndex(ing => ing.id === nextIngredient.id);

    const tempOrder = currentIngredient.displayOrder || 0;
    allIngredients[currentIndex] = {
      ...allIngredients[currentIndex],
      displayOrder: nextIngredient.displayOrder || 0
    };
    allIngredients[nextIndex] = {
      ...allIngredients[nextIndex],
      displayOrder: tempOrder
    };

    onUpdateRecipe({ ingredients: allIngredients });
  };

  const handleMoveSectionUp = (sectionName: string) => {
    const sectionIndex = sortedSections.findIndex(([name]) => name === sectionName);
    if (sectionIndex <= 0) return;

    const currentSection = sortedSections[sectionIndex];
    const prevSection = sortedSections[sectionIndex - 1];

    const minPrevOrder = Math.min(...prevSection[1].map(ing => ing.displayOrder || 0));
    const maxCurrentOrder = Math.max(...currentSection[1].map(ing => ing.displayOrder || 0));

    const allIngredients = [...recipe.ingredients];
    const offset = Math.abs(maxCurrentOrder - minPrevOrder) + 1;

    const updatedIngredients = allIngredients.map(ing => {
      const isInCurrentSection = currentSection[1].some(sectionIng => sectionIng.id === ing.id);
      const isInPrevSection = prevSection[1].some(sectionIng => sectionIng.id === ing.id);

      if (isInCurrentSection) {
        return { ...ing, displayOrder: (ing.displayOrder || 0) - offset };
      } else if (isInPrevSection) {
        return { ...ing, displayOrder: (ing.displayOrder || 0) + offset };
      }
      return ing;
    });

    onUpdateRecipe({ ingredients: updatedIngredients });
  };

  const handleMoveSectionDown = (sectionName: string) => {
    const sectionIndex = sortedSections.findIndex(([name]) => name === sectionName);
    if (sectionIndex >= sortedSections.length - 1) return;

    const currentSection = sortedSections[sectionIndex];
    const nextSection = sortedSections[sectionIndex + 1];

    const maxCurrentOrder = Math.max(...currentSection[1].map(ing => ing.displayOrder || 0));
    const minNextOrder = Math.min(...nextSection[1].map(ing => ing.displayOrder || 0));

    const allIngredients = [...recipe.ingredients];
    const offset = Math.abs(minNextOrder - maxCurrentOrder) + 1;

    const updatedIngredients = allIngredients.map(ing => {
      const isInCurrentSection = currentSection[1].some(sectionIng => sectionIng.id === ing.id);
      const isInNextSection = nextSection[1].some(sectionIng => sectionIng.id === ing.id);

      if (isInCurrentSection) {
        return { ...ing, displayOrder: (ing.displayOrder || 0) + offset };
      } else if (isInNextSection) {
        return { ...ing, displayOrder: (ing.displayOrder || 0) - offset };
      }
      return ing;
    });

    onUpdateRecipe({ ingredients: updatedIngredients });
  };

  const handleOnCreateIngredientSuccess = async (ingredient: AdminIngredient) => {
    setIngredients(prevIngredients => [ingredient, ...prevIngredients]);
    setFilteredIngredients(prevIngredients => [ingredient, ...prevIngredients]);
  };

  const renderSearchIngredientCard = ({ item }: { item: AdminIngredient }) => (
    <TouchableOpacity
      className={`flex-row items-center border border-border-default bg-background-default ${isMobile ? 'p-sm rounded-md mb-md' : 'p-xs rounded-sm mb-xs'}`}
      onPress={() => handleAddRecipeIngredient(item)}
    >
      <Image
        source={item.pictureUrl}
        className={`rounded-sm overflow-hidden ${isMobile ? 'w-16 h-16 mr-xs' : 'w-8 h-8 mr-sm'}`}
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
      />
      <View className="flex-1">
        <Text preset={isMobile ? 'body' : 'bodySmall'}>{getTranslatedField(item.translations, displayLocale || authoringLocale, 'name')}</Text>
      </View>
      <Ionicons name="add-circle-outline" size={isMobile ? 24 : 18} className="text-primary-default" />
    </TouchableOpacity>
  );

  const renderRecipeIngredient = ({ item, section }: { item: AdminRecipeIngredient, section: string }) => {
    const sectionIngredients = groupedIngredients[section] || [];
    const sortedSectionIngredients = [...sectionIngredients].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const sortedIndex = sortedSectionIngredients.findIndex(ing => ing.id === item.id);

    return (
      <AdminRecipeIngredientCard
        recipeIngredient={item}
        displayLocale={displayLocale || authoringLocale}
        onEditPress={() => handleEditRecipeIngredient(item)}
        onDeletePress={() => handleDeleteRecipeIngredient(item)}
        onMoveUpPress={() => handleMoveRecipeIngredientUp(item.id, section)}
        onMoveDownPress={() => handleMoveRecipeIngredientDown(item.id, section)}
        isFirst={sortedIndex === 0}
        isLast={sortedIndex === sortedSectionIngredients.length - 1}
      />
    );
  };

  const renderRecipeSection = (title: string, ingredients: AdminRecipeIngredient[], sectionIndex: number) => {
    const sortedIngredients = [...ingredients].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    return (
      <View className="px-sm mb-md" key={`section-${title}`}>
        <View className="flex-row justify-between items-center mb-sm pb-xs border-b border-border-default">
          {shouldDisplayRecipeSection(title) ? (
            <Text preset="subheading" className="font-semibold flex-1">
              {title}
            </Text>
          ) : null}

          {isWeb && (
            <View className="flex-row items-center gap-xs">
              <TouchableOpacity
                className={`p-1 rounded-sm bg-background-default shadow-sm ${sectionIndex === 0 ? 'opacity-50' : ''}`}
                onPress={() => handleMoveSectionUp(title)}
                disabled={sectionIndex === 0}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons
                  name="chevron-up"
                  size={20}
                  className={sectionIndex === 0 ? 'text-text-secondary' : 'text-primary-default'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                className={`p-1 rounded-sm bg-background-default shadow-sm ${sectionIndex === sortedSections.length - 1 ? 'opacity-50' : ''}`}
                onPress={() => handleMoveSectionDown(title)}
                disabled={sectionIndex === sortedSections.length - 1}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons
                  name="chevron-down"
                  size={20}
                  className={sectionIndex === sortedSections.length - 1 ? 'text-text-secondary' : 'text-primary-default'}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {sortedIngredients.map((ingredient, index) => (
          <View key={`sorted-ingredient-${ingredient.id}`}>
            {renderRecipeIngredient({
              item: ingredient,
              section: title
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View className="mt-xs w-full flex-1">
      {errors.ingredients ? (
        <Text preset="caption" className="text-status-error mb-sm">
          {errors.ingredients}
        </Text>
      ) : null}

      {/* Missing ingredients from AI import */}
      {missingIngredients && missingIngredients.length > 0 && (
        <View className="mb-md p-md rounded-md border border-status-warning" style={{ backgroundColor: '#FFF8E1' }}>
          <View className="flex-row items-center gap-xs mb-sm">
            <Ionicons name="warning-outline" size={18} color={COLORS.status.warning} />
            <Text preset="bodySmall" className="font-semibold" style={{ color: COLORS.status.warning }}>
              {i18n.t('admin.recipes.form.ingredientsInfo.missingFromImport', { defaultValue: 'Missing from AI Import' })}
              {' '}({missingIngredients.length})
            </Text>
          </View>
          <Text preset="caption" className="text-text-secondary mb-sm">
            {i18n.t('admin.recipes.form.ingredientsInfo.missingFromImportHint', { defaultValue: 'These ingredients were not found in the database. Create them or add manually.' })}
          </Text>
          {missingIngredients.map((item: any, idx: number) => {
            const nameEn = item.ingredient?.translations?.find((t: any) => t.locale === 'en')?.name || '';
            const nameEs = item.ingredient?.translations?.find((t: any) => t.locale === 'es')?.name || '';
            const notes = item.translations?.find((t: any) => t.locale === 'en')?.notes || item.translations?.find((t: any) => t.locale === 'es')?.notes || '';
            const tip = item.translations?.find((t: any) => t.locale === 'en')?.tip || item.translations?.find((t: any) => t.locale === 'es')?.tip || '';
            return (
              <View key={`missing-${idx}`} className="flex-row flex-wrap items-baseline gap-xs py-xs border-t border-border-default">
                <Text preset="bodySmall" className="font-semibold">{nameEn || nameEs}</Text>
                {nameEn && nameEs ? <Text preset="caption" className="text-text-secondary">/ {nameEs}</Text> : null}
                <Text preset="caption" className="text-text-secondary">— {item.quantity} {item.measurementUnitID || 'unit'}</Text>
                {notes ? <Text preset="caption" className="text-text-secondary italic">({notes})</Text> : null}
                {tip ? <Text preset="caption" className="text-text-secondary italic">[tip: {tip}]</Text> : null}
                {item.optional ? <Text preset="caption" style={{ color: COLORS.status.warning }}>(optional)</Text> : null}
              </View>
            );
          })}
        </View>
      )}

      <View className="w-full flex-col flex-1">
        {/* Mobile Layout */}
        {isMobile ? (
          <View className="flex-col">
            {/* Search */}
            <View className="mb-md">
              <SearchBar
                placeholder={tForm('admin.recipes.form.ingredientsInfo.searchPlaceholder')}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                className="w-full"
              />
            </View>

            {/* Selected Ingredients (FIRST on mobile) */}
            <View className="mb-lg">
              <View className="flex-row justify-between items-center pb-xs border-b border-border-default mb-sm">
                <Text preset="subheading" className="font-semibold">
                  {tForm('admin.recipes.form.ingredientsInfo.selectedIngredients')}
                </Text>
                <Text preset="caption" color={COLORS.text.secondary}>
                  {recipe.ingredients.length} {tForm('admin.recipes.form.ingredientsInfo.itemsSelected')}
                </Text>
              </View>
              <View className="rounded-md bg-background-secondary overflow-hidden">
                {recipe.ingredients.length === 0 ? (
                  <View className="justify-center items-center p-lg min-h-[120px]">
                    <Ionicons name="basket-outline" size={32} color={COLORS.text.secondary} />
                    <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                      {tForm('admin.recipes.form.ingredientsInfo.noIngredientsSelected')}
                    </Text>
                    <Text preset="caption" color={COLORS.text.secondary} className="mt-xs text-center">
                      {tForm('admin.recipes.form.ingredientsInfo.selectFromBelow', { defaultValue: 'Tap an ingredient below to add it' })}
                    </Text>
                  </View>
                ) : (
                  <View style={{ padding: 12 }}>
                    {sortedSections.map((item, index) => (
                      <React.Fragment key={`section-${item[0]}`}>
                        {renderRecipeSection(item[0], item[1], index)}
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Available Ingredients (SECOND on mobile) */}
            <View>
              <Text preset="subheading" className="mb-sm">
                {tForm('admin.recipes.form.ingredientsInfo.availableIngredients', { defaultValue: 'Available Ingredients' })}
              </Text>
              <View className="rounded-md bg-background-secondary overflow-hidden">
                {loading ? (
                  <View className="justify-center items-center p-lg">
                    <ActivityIndicator size="large" color={COLORS.primary.default} />
                    <Text className="mt-sm" color={COLORS.text.secondary}>
                      {i18n.t('common.loading')}
                    </Text>
                  </View>
                ) : (
                  <View style={{ padding: 12 }}>
                    {filteredIngredients.length > 0 ? (
                      filteredIngredients.map(item => (
                        <React.Fragment key={item.id}>
                          {renderSearchIngredientCard({ item })}
                        </React.Fragment>
                      ))
                    ) : (
                      <View className="justify-center items-center p-lg min-h-[120px]">
                        <Ionicons name="information-circle-outline" size={32} color={COLORS.text.secondary} />
                        <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                          {searchQuery
                            ? tForm('admin.recipes.form.ingredientsInfo.noSearchResults')
                            : tForm('admin.recipes.form.ingredientsInfo.noIngredients')}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          /* ===== DESKTOP LAYOUT: CSS flexbox two-column ===== */
          <View
            style={{
              display: 'flex' as any,
              flexDirection: 'column' as any,
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Header row: search left, label right — aligned */}
            <View
              style={{
                display: 'flex' as any,
                flexDirection: 'row' as any,
                gap: 16,
                marginBottom: 12,
              }}
            >
              <View style={{ flex: 3 }}>
                <TouchableOpacity
                  onPress={() => setNewIngredientModalVisible(true)}
                  className="flex-row items-center gap-xxs mb-xs"
                >
                  <Ionicons name="add" size={14} color={COLORS.text.secondary} />
                  <Text preset="caption" className="text-text-secondary">
                    {i18n.t('admin.ingredients.createTitle')}
                  </Text>
                </TouchableOpacity>
                <SearchBar
                  placeholder={tForm('admin.recipes.form.ingredientsInfo.searchPlaceholder')}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  className="mb-0"
                />
              </View>
              <View style={{ flex: 3, justifyContent: 'center' }}>
                <View className="flex-row justify-between items-center">
                  <Text preset="bodySmall" className="text-text-secondary font-medium">
                    {tForm('admin.recipes.form.ingredientsInfo.selectedIngredients')}
                  </Text>
                  <Text preset="caption" className="text-text-secondary">
                    {recipe.ingredients.length} {tForm('admin.recipes.form.ingredientsInfo.itemsSelected')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Two columns — both scroll independently */}
            <View
              style={{
                display: 'flex' as any,
                flexDirection: 'row' as any,
                gap: 16,
                flex: 1,
                minHeight: 400,
                height: 0,
              }}
            >
              {/* Left: available items (~30%) */}
              <View
                style={{
                  flex: 3,
                  overflow: 'auto' as any,
                  borderRadius: 8,
                  backgroundColor: COLORS.background.secondary,
                  padding: 12,
                  height: '100%',
                }}
              >
                {loading ? (
                  <View className="flex-1 justify-center items-center p-lg">
                    <ActivityIndicator size="large" color={COLORS.primary.default} />
                    <Text className="mt-sm" color={COLORS.text.secondary}>
                      {i18n.t('common.loading')}
                    </Text>
                  </View>
                ) : filteredIngredients.length > 0 ? (
                  filteredIngredients.map(item => (
                    <React.Fragment key={item.id}>
                      {renderSearchIngredientCard({ item })}
                    </React.Fragment>
                  ))
                ) : (
                  <View className="flex-1 justify-center items-center p-lg">
                    <Ionicons name="information-circle-outline" size={32} color={COLORS.text.secondary} />
                    <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                      {searchQuery
                        ? tForm('admin.recipes.form.ingredientsInfo.noSearchResults')
                        : tForm('admin.recipes.form.ingredientsInfo.noIngredients')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Right: selected items (~70%) */}
              <View
                style={{
                  flex: 7,
                  overflow: 'auto' as any,
                  backgroundColor: COLORS.background.secondary,
                  borderRadius: 8,
                  padding: 12,
                  height: '100%',
                }}
              >
                {recipe.ingredients.length === 0 ? (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="basket-outline" size={32} color={COLORS.text.secondary} />
                    <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                      {tForm('admin.recipes.form.ingredientsInfo.noIngredientsSelected')}
                    </Text>
                    <Text preset="caption" color={COLORS.text.secondary} className="mt-xs text-center">
                      {tForm('admin.recipes.form.ingredientsInfo.selectFromLeft')}
                    </Text>
                  </View>
                ) : (
                  sortedSections.map((item, index) => (
                    <React.Fragment key={`section-${item[0]}`}>
                      {renderRecipeSection(item[0], item[1], index)}
                    </React.Fragment>
                  ))
                )}
              </View>
            </View>
          </View>
        )}
      </View>

      <RecipeIngredientFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveRecipeIngredient}
        recipeIngredient={selectedRecipeIngredient}
        measurementUnits={measurementUnits}
        existingIngredients={recipe.ingredients}
        authoringLocale={authoringLocale}
      />

      <CreateEditIngredientModal
        visible={newIngredientModalVisible}
        onClose={() => setNewIngredientModalVisible(false)}
        onSuccess={handleOnCreateIngredientSuccess}
      />

      <AlertModal
        visible={showSuccessAlert}
        title="Success"
        message="Ingredient created successfully"
        onConfirm={() => setShowSuccessAlert(false)}
        confirmText={i18n.t('common.ok')}
      />

      <AlertModal
        visible={showErrorAlert}
        title="Error"
        message={errorMessage}
        onConfirm={() => setShowErrorAlert(false)}
        confirmText={i18n.t('common.ok')}
      />
    </View>
  );
}

export default RecipeIngredientsForm;
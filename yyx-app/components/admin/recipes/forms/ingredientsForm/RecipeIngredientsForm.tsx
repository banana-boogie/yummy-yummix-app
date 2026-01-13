import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Text } from '@/components/common/Text';
import { AdminRecipe, AdminRecipeIngredient, AdminIngredient } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { AdminRecipeIngredientCard } from '@/components/admin/recipes/forms/ingredientsForm/AdminRecipeIngredientCard';
import { adminIngredientsService } from '@/services/admin/adminIngredientsService';
import { FormSection } from '@/components/form/FormSection';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { RecipeIngredientFormModal } from './RecipeIngredientFormModal';
import { SearchBar } from '@/components/common/SearchBar';
import { Image } from 'expo-image';
import { CreateEditIngredientModal } from '@/components/admin/ingredients/CreateEditIngredientModal';
import { Button } from '@/components/common/Button';
import { AlertModal } from '@/components/common/AlertModal';
import { LanguageBadge } from '@/components/common/LanguageBadge';
import { v4 as generateUUID } from 'uuid';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';

type IngredientsFormProps = {
  recipe: AdminRecipe;
  onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
  errors: Record<string, string>;
};

export function RecipeIngredientsForm({ recipe, onUpdateRecipe, errors }: IngredientsFormProps) {
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
  const isWeb = Platform.OS === 'web';

  // Group ingredients by recipeSection
  const groupedIngredients = recipe.ingredients.reduce<Record<string, AdminRecipeIngredient[]>>((acc, ingredient) => {
    const recipeSection = ingredient.recipeSectionEn || ingredient.recipeSectionEs || '';
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
        console.error('Error fetching ingredients:', error);
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
      ingredient =>
        (ingredient.nameEn && ingredient.nameEn.toLowerCase().includes(query)) ||
        (ingredient.nameEs && ingredient.nameEs.toLowerCase().includes(query))
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
        nameEn: '',
        nameEs: '',
        symbolEn: '',
        symbolEs: '',
      },
      optional: false,
      notesEn: '',
      notesEs: '',
      displayOrder: recipe.ingredients ? recipe.ingredients.length : 1,
      recipeSectionEn: 'Main',
      recipeSectionEs: 'Principal'
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
      className="flex-row items-center p-sm border border-border-DEFAULT rounded-md mb-md bg-background-DEFAULT"
      onPress={() => handleAddRecipeIngredient(item)}
    >
      <Image
        source={item.pictureUrl}
        className="w-16 h-16 rounded-sm overflow-hidden mr-xs"
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
      />
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <LanguageBadge language="EN" size="small" />
          <Text className="text-sm ml-1 mb-0 self-center">{item.nameEn}</Text>
        </View>
        <View className="flex-row items-center mb-1">
          <LanguageBadge language="ES" size="small" />
          <Text className="text-sm ml-1 mb-0 self-center">{item.nameEs}</Text>
        </View>
      </View>
      <Ionicons name="add-circle-outline" size={24} className="text-primary-DEFAULT" />
    </TouchableOpacity>
  );

  const renderRecipeIngredient = ({ item, section }: { item: AdminRecipeIngredient, section: string }) => {
    const sectionIngredients = groupedIngredients[section] || [];
    const sortedSectionIngredients = [...sectionIngredients].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const sortedIndex = sortedSectionIngredients.findIndex(ing => ing.id === item.id);

    return (
      <AdminRecipeIngredientCard
        recipeIngredient={item}
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
        <View className="flex-row justify-between items-center mb-sm pb-xs border-b border-border-DEFAULT">
          {shouldDisplayRecipeSection(title) ? (
            <Text preset="subheading" className="font-semibold flex-1">
              {title}
            </Text>
          ) : null}

          {isWeb && (
            <View className="flex-row items-center gap-xs">
              <TouchableOpacity
                className={`p-1 rounded-sm bg-background-DEFAULT shadow-sm ${sectionIndex === 0 ? 'opacity-50' : ''}`}
                onPress={() => handleMoveSectionUp(title)}
                disabled={sectionIndex === 0}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons
                  name="chevron-up"
                  size={20}
                  className={sectionIndex === 0 ? 'text-text-SECONDARY' : 'text-primary-DEFAULT'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                className={`p-1 rounded-sm bg-background-DEFAULT shadow-sm ${sectionIndex === sortedSections.length - 1 ? 'opacity-50' : ''}`}
                onPress={() => handleMoveSectionDown(title)}
                disabled={sectionIndex === sortedSections.length - 1}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons
                  name="chevron-down"
                  size={20}
                  className={sectionIndex === sortedSections.length - 1 ? 'text-text-SECONDARY' : 'text-primary-DEFAULT'}
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
    <FormSection title={i18n.t('admin.recipes.form.ingredientsInfo.title')} maxWidth={1000} className="mb-md">
      {errors.ingredients ? (
        <Text preset="caption" className="text-status-ERROR mb-sm">
          {errors.ingredients}
        </Text>
      ) : null}

      <Button
        variant="outline"
        size="small"
        onPress={() => setNewIngredientModalVisible(true)}
        className="self-start mb-md"
      >
        {i18n.t('admin.ingredients.createTitle')}
      </Button>

      <View className="w-full flex-col flex-1">
        {/* Mobile Layout */}
        {isMobile ? (
          <View className="flex-col">
            {/* Search */}
            <View className="mb-md">
              <SearchBar
                placeholder={i18n.t('admin.recipes.form.ingredientsInfo.searchPlaceholder')}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                className="w-full"
              />
            </View>

            {/* Selected Ingredients (FIRST on mobile) */}
            <View className="mb-lg">
              <View className="flex-row justify-between items-center pb-xs border-b border-border-DEFAULT mb-sm">
                <Text preset="subheading" className="font-semibold">
                  {i18n.t('admin.recipes.form.ingredientsInfo.selectedIngredients')}
                </Text>
                <Text preset="caption" color={COLORS.text.secondary}>
                  {recipe.ingredients.length} {i18n.t('admin.recipes.form.ingredientsInfo.itemsSelected')}
                </Text>
              </View>
              <View className="rounded-md bg-background-SECONDARY overflow-hidden">
                {recipe.ingredients.length === 0 ? (
                  <View className="justify-center items-center p-lg min-h-[120px]">
                    <Ionicons name="basket-outline" size={32} color={COLORS.text.secondary} />
                    <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                      {i18n.t('admin.recipes.form.ingredientsInfo.noIngredientsSelected')}
                    </Text>
                    <Text preset="caption" color={COLORS.text.secondary} className="mt-xs text-center">
                      {i18n.t('admin.recipes.form.ingredientsInfo.selectFromBelow', { defaultValue: 'Tap an ingredient below to add it' })}
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
                {i18n.t('admin.recipes.form.ingredientsInfo.availableIngredients', { defaultValue: 'Available Ingredients' })}
              </Text>
              <View className="rounded-md bg-background-SECONDARY overflow-hidden">
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
                            ? i18n.t('admin.recipes.form.ingredientsInfo.noSearchResults')
                            : i18n.t('admin.recipes.form.ingredientsInfo.noIngredients')}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          /* Desktop Layout */
          <>
            <View className="flex-row gap-xl mb-md">
              <View className="flex-[1.2]">
                <SearchBar
                  placeholder={i18n.t('admin.recipes.form.ingredientsInfo.searchPlaceholder')}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  className="w-full"
                />
              </View>
              <View className="flex-[2.5] flex-row justify-between items-center pb-xs border-b border-border-DEFAULT">
                <Text preset="subheading" className="font-semibold">
                  {i18n.t('admin.recipes.form.ingredientsInfo.selectedIngredients')}
                </Text>
                <View className="flex-row items-center">
                  <Text preset="caption" color={COLORS.text.secondary}>
                    {recipe.ingredients.length} {i18n.t('admin.recipes.form.ingredientsInfo.itemsSelected')}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-1 min-h-[400px] flex-row gap-lg">
              <View className="flex-[1.2] rounded-md bg-background-SECONDARY overflow-hidden">
                {loading ? (
                  <View className="flex-1 justify-center items-center p-lg">
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
                      <View className="flex-1 justify-center items-center p-lg min-h-[200px]">
                        <Ionicons name="information-circle-outline" size={32} color={COLORS.text.secondary} />
                        <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                          {searchQuery
                            ? i18n.t('admin.recipes.form.ingredientsInfo.noSearchResults')
                            : i18n.t('admin.recipes.form.ingredientsInfo.noIngredients')}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View className="flex-[2.5] rounded-md bg-background-SECONDARY overflow-hidden">
                {recipe.ingredients.length === 0 ? (
                  <View className="flex-1 justify-center items-center p-lg min-h-[200px]">
                    <Ionicons name="basket-outline" size={32} color={COLORS.text.secondary} />
                    <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                      {i18n.t('admin.recipes.form.ingredientsInfo.noIngredientsSelected')}
                    </Text>
                    <Text preset="caption" color={COLORS.text.secondary} className="mt-xs text-center">
                      {i18n.t('admin.recipes.form.ingredientsInfo.selectFromLeft')}
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
          </>
        )}
      </View>

      <RecipeIngredientFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveRecipeIngredient}
        recipeIngredient={selectedRecipeIngredient}
        measurementUnits={measurementUnits}
        existingIngredients={recipe.ingredients}
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
    </FormSection>
  );
}

export default RecipeIngredientsForm;
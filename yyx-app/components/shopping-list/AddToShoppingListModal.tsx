import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Text, Button } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { shoppingListService } from '@/services/shoppingListService';
import type { ShoppingList } from '@/types/shopping-list.types';

export interface AddToShoppingListIngredient {
  /** Row id in recipe_ingredients or any unique id for list keys. */
  key: string;
  /** Canonical ingredient id, when known; enables duplicate consolidation. */
  ingredientId?: string | null;
  /** Display name, used when ingredientId is missing. */
  name: string;
  quantity: number;
  /** measurement_units.id */
  unitId?: string | null;
  unitLabel?: string;
}

interface AddToShoppingListModalProps {
  visible: boolean;
  onClose: () => void;
  recipeName?: string;
  recipeId?: string | null;
  ingredients: AddToShoppingListIngredient[];
  onAdded?: (listId: string, addedCount: number) => void;
}

/**
 * Lets the user pick ingredients from a recipe and append them to a shopping
 * list. Defaults all ingredients checked; the user unchecks any they already
 * have. Creates a new list if the user has none.
 */
export function AddToShoppingListModal({
  visible,
  onClose,
  recipeName,
  recipeId,
  ingredients,
  onAdded,
}: AddToShoppingListModalProps) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelectedKeys(new Set(ingredients.map((i) => i.key)));
    setLoading(true);
    shoppingListService
      .getShoppingLists()
      .then((result) => {
        setLists(result);
        setSelectedListId(result[0]?.id ?? null);
      })
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
    // Intentionally only re-run on `visible` transition; ingredient identity may
    // change across re-renders without us wanting to refetch lists or reset
    // checks the user already toggled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const selectedCount = selectedKeys.size;
  const canSubmit = selectedCount > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      let listId = selectedListId;
      if (!listId) {
        const created = await shoppingListService.createShoppingList(
          recipeName ?? i18n.t('shoppingList.createNew'),
        );
        listId = created.id;
      }
      const picked = ingredients
        .filter((ing) => selectedKeys.has(ing.key))
        .map((ing) => ({
          ingredientId: ing.ingredientId ?? null,
          name: ing.name,
          quantity: ing.quantity,
          unitId: ing.unitId ?? null,
          recipeId: recipeId ?? null,
        }));
      await shoppingListService.addRecipeIngredients(listId, picked);
      onAdded?.(listId, picked.length);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, selectedListId, ingredients, selectedKeys, recipeId, recipeName, onAdded, onClose]);

  const listOptions = useMemo(() => lists, [lists]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-primary-lightest rounded-t-xl p-lg">
          <View className="flex-row items-center justify-between mb-md">
            <Text preset="h2">{i18n.t('shoppingList.addToList')}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel={i18n.t('common.close')}>
              <Ionicons name="close" size={24} color={COLORS.text.default} />
            </TouchableOpacity>
          </View>

          {recipeName ? (
            <Text preset="caption" className="text-text-secondary mb-md">{recipeName}</Text>
          ) : null}

          {loading ? (
            <ActivityIndicator />
          ) : (
            <>
              {listOptions.length > 0 ? (
                <FlatList
                  horizontal
                  data={listOptions}
                  keyExtractor={(l) => l.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                  className="mb-md"
                  renderItem={({ item }) => {
                    const active = item.id === selectedListId;
                    return (
                      <TouchableOpacity
                        onPress={() => setSelectedListId(item.id)}
                        className={`px-md py-sm rounded-md ${active ? 'bg-primary-medium' : 'bg-primary-light'}`}
                      >
                        <Text preset="bodySmall">{item.name}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              ) : (
                <Text preset="caption" className="text-text-secondary mb-md">
                  {i18n.t('shoppingList.empty')}
                </Text>
              )}

              <FlatList
                data={ingredients}
                keyExtractor={(i) => i.key}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => {
                  const checked = selectedKeys.has(item.key);
                  return (
                    <TouchableOpacity
                      onPress={() => toggle(item.key)}
                      className="flex-row items-center py-sm"
                    >
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={checked ? COLORS.primary.darkest : COLORS.grey.medium}
                      />
                      <Text preset="body" className="ml-sm flex-1">
                        {item.name}
                      </Text>
                      <Text preset="caption" className="text-text-secondary ml-sm">
                        {item.quantity}
                        {item.unitLabel ? ` ${item.unitLabel}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />

              <Button
                variant="primary"
                onPress={handleSubmit}
                disabled={!canSubmit}
                className="mt-md"
              >
                {submitting
                  ? i18n.t('common.loading')
                  : `${i18n.t('shoppingList.addToList')} (${selectedCount})`}
              </Button>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default AddToShoppingListModal;

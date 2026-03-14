import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AdminIngredient } from '@/types/recipe.admin.types';
import adminIngredientsService from '@/services/admin/adminIngredientsService';

interface UseIngredientsReturn {
  ingredients: AdminIngredient[];
  filteredIngredients: AdminIngredient[];
  setFilteredIngredients: Dispatch<SetStateAction<AdminIngredient[]>>;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleDeleteIngredient: (ingredient: AdminIngredient) => Promise<void>;
  refreshIngredients: () => Promise<void>;
}

export function useIngredients(): UseIngredientsReturn {
  const [ingredients, setIngredients] = useState<AdminIngredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<AdminIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const fetchedIngredients = await adminIngredientsService.getAllIngredientsForAdmin();
      setIngredients(fetchedIngredients);
      setFilteredIngredients(fetchedIngredients);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIngredient = async (ingredient: AdminIngredient) => {
    try {
      if (ingredient.pictureUrl) {
        try {
          await adminIngredientsService.deleteImage(ingredient.pictureUrl);
        } catch (imgError) {
          console.error('Error deleting image:', imgError);
        }
      }

      await adminIngredientsService.deleteIngredient(ingredient.id);
      
      // Update local state only after both operations complete
      setIngredients(prev => prev.filter(item => item.id !== ingredient.id));
      setFilteredIngredients(prev => prev.filter(item => item.id !== ingredient.id));
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      throw error;
    }
  };


  // Filter ingredients when search query changes — searches all translations
  useEffect(() => {
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = ingredients.filter(ingredient =>
        ingredient.translations.some(t =>
          t.name?.toLowerCase().includes(lowerQuery) ||
          t.pluralName?.toLowerCase().includes(lowerQuery)
        )
      );
      setFilteredIngredients(filtered);
    } else {
      setFilteredIngredients(ingredients);
    }
  }, [ingredients, searchQuery]);

  // Initial fetch
  useEffect(() => {
    fetchIngredients();
  }, []);

  return {
    ingredients,
    filteredIngredients,
    setFilteredIngredients,
    loading,
    searchQuery,
    setSearchQuery,
    handleDeleteIngredient,
    refreshIngredients: fetchIngredients,
  };
} 
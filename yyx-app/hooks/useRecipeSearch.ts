import { useState, useEffect, useMemo } from 'react';
import { Recipe } from '@/types/recipe.types';

// Utility function to calculate string similarity (for typo tolerance)
const levenshteinDistance = (str1: string, str2: string): number => {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  return track[str2.length][str1.length];
};

const removeAccents = (str: string): string => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

export const useRecipeSearch = (recipes: Recipe[], searchQuery: string, selectedTag?: string) => {
  const filteredRecipes = useMemo(() => {
    // Guard against undefined/null recipes
    if (!recipes) return [];
    let result = recipes;

    // First filter by tag if selected
    if (selectedTag) {
      result = recipes.filter(recipe => 
        recipe.tags?.some(tag => {
          // Guard against undefined tag name
          if (!tag?.name) return false;
          const tagName = removeAccents(tag.name.toLowerCase());
          if (Array.isArray(selectedTag)) {
            return selectedTag.some(st => removeAccents(st.toLowerCase()) === tagName);
          }
          return removeAccents(selectedTag.toLowerCase()) === tagName;
        })
      );
    }

    // Then apply text search if there's a query
    if (searchQuery.trim() && searchQuery !== selectedTag) {
      const searchTerms = removeAccents(searchQuery.toLowerCase()).split(/\s+/);
      
      const scoredRecipes = result.map(recipe => {
        let score = 0;
        
        for (const term of searchTerms) {
          // Guard against undefined recipe name
          if (recipe.name) {
            const nameMatch = removeAccents(recipe.name.toLowerCase()).includes(term);
            if (nameMatch) score += 10;
          }

          // Check ingredients with null check
          const ingredientMatch = recipe.ingredients?.some(ingredient => {
            if (!ingredient?.name) return false;
            const ingredientName = removeAccents(ingredient.name.toLowerCase());
            return levenshteinDistance(ingredientName, term) <= 2 || 
                   ingredientName.includes(term);
          });
          if (ingredientMatch) score += 5;

          // Check tags with null check
          const tagMatch = recipe.tags?.some(tag => 
            tag?.name ? removeAccents(tag.name.toLowerCase()).includes(term) : false
          );
          if (tagMatch) score += 3;
        }

        return { recipe, score };
      });

      result = scoredRecipes
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.recipe);
    }

    return result;
  }, [searchQuery, selectedTag, recipes]);

  return filteredRecipes;
}; 
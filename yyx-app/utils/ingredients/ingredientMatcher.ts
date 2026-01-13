import { AdminIngredient, AdminRecipeIngredient, AdminRecipeStepIngredient } from '@/types/recipe.admin.types';

// Types
type IngredientMatchOptions = {
  similarityThreshold?: number;
  ignorePrep?: boolean;
};

// Constants
const DISTINCT_INGREDIENTS = [
  { base: 'sugar', distinct: ['brown sugar', 'powdered sugar', 'granulated sugar'] },
  { base: 'flour', distinct: ['all-purpose flour', 'bread flour', 'cake flour'] },
  // Add more as needed
];

const PREP_PREFIXES = ['chopped ', 'diced ', 'sliced ', 'minced ', 'grated ', 'large ', 'freshly squeezed ', ' cloves ', 'fresh ', 'extra virgin '];


interface IngredientNameFields {
  nameEn?: string;
  nameEs?: string;
  pluralNameEn?: string;
  pluralNameEs?: string;
}

export class IngredientMatcher {
  private similarityThreshold: number;
  private ignorePrep: boolean;

  constructor(options: IngredientMatchOptions = {}) {
    this.similarityThreshold = options.similarityThreshold ?? 0.8;
    this.ignorePrep = options.ignorePrep ?? true;
  }

  private normalizeIngredientName(name: string | undefined): string {
    if (!name) return '';
    return name.toLowerCase().trim();
  }

  private isIngredientVariation(name1: string, name2: string): boolean {
    const n1 = this.normalizeIngredientName(name1);
    const n2 = this.normalizeIngredientName(name2);
    
    // Exact match
    if (n1 === n2) return true;
    
    // Check if either name is in the distinct ingredients list
    for (const { base, distinct } of DISTINCT_INGREDIENTS) {
      if ((n1 === base && distinct.includes(n2)) || 
          (n2 === base && distinct.includes(n1))) {
        return false; // These should not match (e.g., sugar ≠ brown sugar)
      }
    }
    
    if (this.ignorePrep) {
      // Remove prep method prefixes
      const stripped1 = PREP_PREFIXES.reduce((str, prefix) => str.replace(prefix, ''), n1);
      const stripped2 = PREP_PREFIXES.reduce((str, prefix) => str.replace(prefix, ''), n2);
      return stripped1 === stripped2;
    }

    return false;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  private editDistance(s1: string, s2: string): number {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  public findMatch(
    searchIngredient: AdminRecipeStepIngredient,
    availableIngredients: AdminRecipeIngredient[] | AdminIngredient[]
  ): AdminRecipeIngredient | AdminIngredient | null {
    // First try exact matches
    const exactMatch = availableIngredients.find(ingredient =>
      this.hasNameMatch(this.extractNameFields(searchIngredient), this.extractNameFields(ingredient))
  );

    if (exactMatch) return exactMatch;

    // If no exact match, try fuzzy matching
    const fuzzyMatch = availableIngredients.find(ingredient =>
      this.hasFuzzyMatch(this.extractNameFields(searchIngredient), this.extractNameFields(ingredient))
    );

    return fuzzyMatch || null;
  }

  private extractNameFields(ingredient: AdminIngredient | AdminRecipeIngredient | AdminRecipeStepIngredient): IngredientNameFields {
    if ('ingredient' in ingredient) {
      return {
        nameEn: ingredient.ingredient.nameEn,
        nameEs: ingredient.ingredient.nameEs,
        pluralNameEn: ingredient.ingredient.pluralNameEn,
        pluralNameEs: ingredient.ingredient.pluralNameEs
      };
    }
    
    return {
      nameEn: ingredient.nameEn,
      nameEs: ingredient.nameEs,
      pluralNameEn: ingredient.pluralNameEn,
      pluralNameEs: ingredient.pluralNameEs
    };
  }

  private hasNameMatch(search: IngredientNameFields, ingredient: IngredientNameFields): boolean {
    return (
      this.isIngredientVariation(search.nameEn || '', ingredient.nameEn || '') ||
      this.isIngredientVariation(search.nameEn || '', ingredient.pluralNameEn || '') ||
      this.isIngredientVariation(search.nameEs || '', ingredient.nameEs || '') ||
      this.isIngredientVariation(search.nameEs || '', ingredient.pluralNameEs || '')
    );
  }

  private hasFuzzyMatch(search: IngredientNameFields, ingredient: IngredientNameFields): boolean {
    const nameEnSimilarity = this.calculateSimilarity(
      search.nameEn || '',
      ingredient.nameEn || ''
    );
    const nameEsSimilarity = this.calculateSimilarity(
      search.nameEs || '',
      ingredient.nameEs || ''
    );
    
    return nameEnSimilarity >= this.similarityThreshold || 
           nameEsSimilarity >= this.similarityThreshold;
  }
}

// Export a default instance with standard options
export const defaultMatcher = new IngredientMatcher(); 
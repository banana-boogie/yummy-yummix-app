import { AdminIngredient, AdminRecipeIngredient, AdminRecipeStepIngredient, getTranslatedField } from '@/types/recipe.admin.types';

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

const UNIT_SUFFIXES = [
  // English
  'sprig', 'sprigs', 'clove', 'cloves', 'leaf', 'leaves',
  'slice', 'slices', 'piece', 'pieces', 'cube', 'cubes',
  // Spanish
  'ramita', 'ramitas', 'diente', 'dientes', 'hoja', 'hojas',
  'rebanada', 'rebanadas', 'trozo', 'trozos', 'cubo', 'cubos', 'pizca',
];

const UNIT_OF_PREFIXES_EN = [
  'sprig of ', 'clove of ', 'slice of ', 'piece of ', 'cube of ', 'leaf of ',
];

const UNIT_OF_PREFIXES_ES = [
  'ramita de ', 'diente de ', 'hoja de ', 'rebanada de ', 'trozo de ', 'cubo de ', 'pizca de ',
];

// All translatable names for an ingredient, collected across locales
interface IngredientNames {
  names: string[];
  pluralNames: string[];
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
      let stripped1 = PREP_PREFIXES.reduce((str, prefix) => str.replace(prefix, ''), n1);
      let stripped2 = PREP_PREFIXES.reduce((str, prefix) => str.replace(prefix, ''), n2);

      // Strip trailing unit suffixes (e.g., "rosemary sprig" -> "rosemary")
      for (const suffix of UNIT_SUFFIXES) {
        if (stripped1.endsWith(` ${suffix}`)) {
          stripped1 = stripped1.slice(0, -(suffix.length + 1)).trim();
        }
        if (stripped2.endsWith(` ${suffix}`)) {
          stripped2 = stripped2.slice(0, -(suffix.length + 1)).trim();
        }
      }

      // Strip leading "unit of" patterns (e.g., "sprig of rosemary" -> "rosemary")
      const allUnitOfPrefixes = [...UNIT_OF_PREFIXES_EN, ...UNIT_OF_PREFIXES_ES];
      for (const prefix of allUnitOfPrefixes) {
        if (stripped1.startsWith(prefix)) {
          stripped1 = stripped1.slice(prefix.length).trim();
        }
        if (stripped2.startsWith(prefix)) {
          stripped2 = stripped2.slice(prefix.length).trim();
        }
      }

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
      this.hasNameMatch(this.extractNames(searchIngredient), this.extractNames(ingredient))
  );

    if (exactMatch) return exactMatch;

    // If no exact match, try fuzzy matching
    const fuzzyMatch = availableIngredients.find(ingredient =>
      this.hasFuzzyMatch(this.extractNames(searchIngredient), this.extractNames(ingredient))
    );

    return fuzzyMatch || null;
  }

  private extractNames(ingredient: AdminIngredient | AdminRecipeIngredient | AdminRecipeStepIngredient): IngredientNames {
    const getNames = (ing: any): IngredientNames => {
      const translations = ing.translations ?? [];
      return {
        names: translations.map((t: any) => t.name).filter(Boolean),
        pluralNames: translations.map((t: any) => t.pluralName).filter(Boolean),
      };
    };

    if ('ingredient' in ingredient) {
      return getNames(ingredient.ingredient);
    }

    return getNames(ingredient);
  }

  private hasNameMatch(search: IngredientNames, ingredient: IngredientNames): boolean {
    const allIngredientNames = [...ingredient.names, ...ingredient.pluralNames];
    return search.names.some(searchName =>
      allIngredientNames.some(ingName => this.isIngredientVariation(searchName, ingName))
    );
  }

  private hasFuzzyMatch(search: IngredientNames, ingredient: IngredientNames): boolean {
    return search.names.some(searchName =>
      ingredient.names.some(ingName =>
        this.calculateSimilarity(searchName, ingName) >= this.similarityThreshold
      )
    );
  }
}

// Export a default instance with standard options
export const defaultMatcher = new IngredientMatcher();

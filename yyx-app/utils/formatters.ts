export const formatToSnakeCase = (str: string): string => {
  return str.replace(/([\s])/g, '_').toLowerCase();
};

export const formatToScreamingSnakeCase = (str: string): string => {
  return str.replace(/([\s])/g, '_').toUpperCase();
};

/**
 * Normalizes a filename by:
 * 1. Removing accent/diacritics (é -> e)
 * 2. Converting to lowercase
 * 3. Converting any sequence of non-alphanumeric characters to a single underscore
 * 4. Removing leading/trailing underscores
 * 
 * Examples:
 * "Sopa de Brócoli" -> "sopa_de_brocoli"
 * "Café&Tea" -> "cafe_tea"
 * "My-File.txt" -> "my_file_txt"
 * 
 * @param filename The filename to normalize
 * @returns The normalized filename
 */
export const normalizeFileName = (filename: string): string => {
  return filename
    // Step 1: Remove accents/diacritics (é -> e, ñ -> n, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Step 2: Convert to lowercase
    .toLowerCase()
    // Step 3: Replace any sequence of non-alphanumeric characters with a single underscore
    .replace(/[^a-z0-9]+/g, '_')
    // Step 4: Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '');
};

/**
 * Formats a category name from SCREAMING_SNAKE_CASE to Title Case
 * Example: FOOD_AND_DRINK -> Food And Drink
 */
export function formatCategoryNameToTitleCase(category: string): string {
  return category
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Transforms tag categories between display format (Title Case) and database format (SCREAMING_SNAKE_CASE)
 */
export const transformCategories = {
  // For display: FOOD_AND_DRINK -> Food And Drink
  toDisplay: (categories: string[]): string[] => {
    return categories.map(formatCategoryNameToTitleCase);
  },
  
  // For database: Food And Drink -> FOOD_AND_DRINK
  toDatabase: (categories: string[]): string[] => {
    return categories.map(formatToScreamingSnakeCase);
  }
};

export const formatTimeInHoursAndMinutes = (minutes: number | null): string => {
  if (minutes === null) return '';
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
}; 
import i18n from '@/i18n';

export const formatToSnakeCase = (str: string): string => {
  return str.replace(/([\s])/g, '_').toLowerCase();
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

export function formatCategoryForDisplay(category: string): string {
  return i18n.t(`admin.tags.categoryLabels.${category}`, {
    defaultValue: category,
  });
}

export const formatTimeInHoursAndMinutes = (minutes: number | null): string => {
  if (minutes === null) return '';

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
};

/**
 * Determines if a recipe section name should be displayed
 * Returns false for "main" or "principal" sections (case insensitive)
 */
export const shouldDisplayRecipeSection = (sectionName?: string | null): boolean => {
  if (!sectionName) return false;
  
  const normalizedSection = sectionName.trim().toLowerCase();
  return !['main', 'principal'].includes(normalizedSection);
};

// Other general recipe utility functions can go here 
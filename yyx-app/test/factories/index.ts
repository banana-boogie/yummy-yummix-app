/**
 * Test Data Factories
 *
 * Central export for all test data factories.
 *
 * FOR AI AGENTS:
 * - Import factories from this file: `import { recipeFactory, userFactory } from '@/test/factories'`
 * - Use factory methods to generate realistic test data
 * - Override only the fields relevant to your specific test
 *
 * @example
 * ```typescript
 * import { recipeFactory, userFactory } from '@/test/factories';
 *
 * // Create test data
 * const recipe = recipeFactory.create({ difficulty: RecipeDifficulty.EASY });
 * const user = userFactory.createSupabaseUser();
 * const profile = userFactory.createProfile({ isAdmin: true });
 *
 * // Create lists
 * const recipes = recipeFactory.createList(10);
 * const profiles = userFactory.createProfileList(5);
 * ```
 */

export { recipeFactory } from './recipe.factory';
export { userFactory } from './user.factory';

// Re-export individual functions for convenience
export {
  createRecipe,
  createRecipeList,
  createIngredient,
  createIngredientList,
  createStep,
  createStepList,
  createTag,
  createTagList,
  createUsefulItem,
  createMeasurementUnit,
  resetIdCounter as resetRecipeIdCounter,
} from './recipe.factory';

export {
  createSupabaseUser,
  createAdminSupabaseUser,
  createUserProfile,
  createAdminProfile,
  createNewUserProfile,
  createUserProfileList,
  resetIdCounter as resetUserIdCounter,
} from './user.factory';

/**
 * Resets all factory ID counters for deterministic test behavior.
 * This is called automatically in beforeEach via jest.setup.js.
 */
export function resetAllFactories(): void {
  const { resetIdCounter: resetRecipe } = require('./recipe.factory');
  const { resetIdCounter: resetUser } = require('./user.factory');
  resetRecipe();
  resetUser();
}

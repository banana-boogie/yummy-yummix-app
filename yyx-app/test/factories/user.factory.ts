/**
 * User Test Data Factory
 *
 * Generates realistic user and profile test data for use in tests.
 *
 * FOR AI AGENTS:
 * - Use these factories instead of manually creating user data
 * - Use createSupabaseUser() for auth-related tests
 * - Use createUserProfile() for profile-related tests
 *
 * @example
 * ```typescript
 * import { userFactory } from '@/test/factories';
 *
 * // Create a Supabase User (for auth tests)
 * const user = userFactory.createSupabaseUser();
 *
 * // Create a UserProfile (for profile tests)
 * const profile = userFactory.createProfile({ name: 'Test User' });
 *
 * // Create admin user
 * const admin = userFactory.createProfile({ isAdmin: true });
 * ```
 */

import type { User } from '@supabase/supabase-js';
import type { UserProfile, Gender, ActivityLevel } from '@/types/user';
import { MeasurementSystem } from '@/types/user';

// ============================================================
// COUNTER FOR UNIQUE IDS
// ============================================================

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `test-user-${idCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Resets the ID counter for deterministic test behavior.
 * Call this in beforeEach to ensure tests don't depend on execution order.
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================
// SAMPLE DATA POOLS
// ============================================================

const firstNames = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava',
  'Ethan', 'Sophia', 'Mason', 'Isabella', 'William',
  'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
];

const usernames = [
  'chef_master', 'foodie_lover', 'kitchen_ninja', 'cooking_pro',
  'recipe_hunter', 'taste_explorer', 'gourmet_fan', 'home_cook',
  'meal_prepper', 'flavor_seeker', 'culinary_artist', 'dish_creator',
];

const dietaryRestrictions = [
  'gluten_free', 'dairy_free', 'nut_free', 'egg_free',
  'soy_free', 'shellfish_free', 'fish_free',
];

const dietTypes = [
  'vegetarian', 'vegan', 'pescatarian', 'keto',
  'paleo', 'mediterranean', 'low_carb',
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSubset<T>(array: T[], maxCount: number): T[] {
  const count = randomInt(0, Math.min(maxCount, array.length));
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateEmail(): string {
  const firstName = randomElement(firstNames).toLowerCase();
  const lastName = randomElement(lastNames).toLowerCase();
  const domain = randomElement(['gmail.com', 'yahoo.com', 'outlook.com', 'example.com']);
  return `${firstName}.${lastName}${randomInt(1, 999)}@${domain}`;
}

function generateBirthDate(): string {
  const year = randomInt(1960, 2005);
  const month = randomInt(1, 12).toString().padStart(2, '0');
  const day = randomInt(1, 28).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================
// SUPABASE USER FACTORY
// ============================================================

/**
 * Creates a mock Supabase User object.
 * Use this for testing authentication flows.
 *
 * @example
 * ```typescript
 * const user = userFactory.createSupabaseUser();
 * mockSupabaseAuthSuccess(user);
 * ```
 */
export function createSupabaseUser(overrides?: Partial<User>): User {
  const id = generateId();
  const email = generateEmail();
  const now = new Date().toISOString();

  return {
    id,
    email,
    app_metadata: {
      provider: 'email',
      providers: ['email'],
    },
    user_metadata: {
      email,
      email_verified: true,
      phone_verified: false,
      sub: id,
    },
    aud: 'authenticated',
    role: 'authenticated',
    created_at: now,
    updated_at: now,
    email_confirmed_at: now,
    phone: null,
    confirmed_at: now,
    last_sign_in_at: now,
    factors: null,
    identities: [],
    ...overrides,
  } as User;
}

/**
 * Creates an admin Supabase User.
 */
export function createAdminSupabaseUser(overrides?: Partial<User>): User {
  return createSupabaseUser({
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      role: 'admin',
    },
    ...overrides,
  });
}

// ============================================================
// USER PROFILE FACTORY
// ============================================================

/**
 * Creates a UserProfile object.
 * Use this for testing profile-related functionality.
 *
 * @example
 * ```typescript
 * const profile = userFactory.createProfile();
 * const vegetarianProfile = userFactory.createProfile({
 *   dietTypes: ['vegetarian'],
 * });
 * ```
 */
export function createUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  const firstName = randomElement(firstNames);
  const lastName = randomElement(lastNames);
  const now = new Date().toISOString();
  const createdAt = new Date(Date.now() - randomInt(1, 365) * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: generateId(),
    email: generateEmail(),
    name: `${firstName} ${lastName}`,
    username: `${randomElement(usernames)}${randomInt(1, 999)}`,
    biography: Math.random() > 0.5 ? 'Home cook who loves experimenting with new recipes!' : null,
    gender: randomElement(['male', 'female', 'other', 'preferNotToSay'] as Gender[]),
    birthDate: generateBirthDate(),
    height: randomInt(150, 200), // cm
    weight: randomInt(50, 100), // kg
    activityLevel: randomElement([
      'sedentary',
      'lightlyActive',
      'moderatelyActive',
      'veryActive',
      'extraActive',
    ] as ActivityLevel[]),
    dietaryRestrictions: randomSubset(dietaryRestrictions, 3) as any[],
    dietTypes: randomSubset(dietTypes, 2) as any[],
    measurementSystem: randomElement([MeasurementSystem.METRIC, MeasurementSystem.IMPERIAL]),
    language: randomElement(['en', 'es']),
    profileImageUrl: Math.random() > 0.3
      ? `https://images.test.com/profiles/${generateId()}.jpg`
      : null,
    onboardingComplete: Math.random() > 0.2,
    isAdmin: false,
    createdAt,
    updatedAt: now,
    otherAllergy: Math.random() > 0.8 ? ['sesame'] : [],
    otherDiet: Math.random() > 0.8 ? ['whole30'] : [],
    ...overrides,
  };
}

/**
 * Creates an admin UserProfile.
 */
export function createAdminProfile(overrides?: Partial<UserProfile>): UserProfile {
  return createUserProfile({
    isAdmin: true,
    onboardingComplete: true,
    ...overrides,
  });
}

/**
 * Creates a new user profile (onboarding not complete).
 */
export function createNewUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  return createUserProfile({
    onboardingComplete: false,
    biography: null,
    profileImageUrl: null,
    ...overrides,
  });
}

/**
 * Creates multiple user profiles.
 */
export function createUserProfileList(count: number): UserProfile[] {
  return Array.from({ length: count }, () => createUserProfile());
}

// ============================================================
// FACTORY OBJECT EXPORT
// ============================================================

/**
 * User factory object with all creation methods.
 *
 * FOR AI AGENTS: Use this object for all user-related test data.
 */
export const userFactory = {
  // Supabase User
  createSupabaseUser,
  createAdminSupabaseUser,

  // UserProfile
  createProfile: createUserProfile,
  createAdminProfile,
  createNewUserProfile,
  createProfileList: createUserProfileList,

  // Utilities
  resetIdCounter,
};

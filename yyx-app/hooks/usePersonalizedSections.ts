/**
 * usePersonalizedSections
 *
 * Builds the Explore page section list from a paginated recipe list,
 * the user's profile, and the active meal plan (if any).
 *
 * Order: todaysMeal, forYou, favourites, quickEasy, worthATry, popular, all.
 * Empty sections are filtered out. Recipes are deduped across primary
 * sections so a single recipe only shows up once.
 *
 * Restriction filtering (allergies / explicit restrictions) is applied to
 * every section by default. Preferred diet types drive ranking but do NOT
 * gate recipes — that's what the filter chips are for.
 */

import { useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import type { Recipe } from '@/types/recipe.types';
import type { UserProfile } from '@/types/user';
import type { DietaryRestriction } from '@/types/dietary';
import type { RecipeSection } from '@/components/recipe/RecipeSectionList';
import type { MealPlan, MealPlanSlot } from '@/types/mealPlan';

const SEEN_STORAGE_KEY = '@yyx/explore/for-you-seen';
const SEEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SeenMap = Record<string, number>;

/**
 * Lowercase token set from a recipe's searchable fields used for
 * matching against restriction / diet keywords.
 */
function recipeKeywords(recipe: Recipe): Set<string> {
  const tokens = new Set<string>();
  const push = (s: string | undefined | null) => {
    if (!s) return;
    s.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .forEach((t) => tokens.add(t));
  };
  push(recipe.name);
  push(recipe.description);
  (recipe.tags ?? []).forEach((t) => {
    push(t.name);
    (t.categories ?? []).forEach((c) => push(c));
  });
  (recipe.ingredients ?? []).forEach((ing) => push(ing.name));
  return tokens;
}

/**
 * Keyword lookup for each restriction group. Extend as needed.
 */
const RESTRICTION_KEYWORDS: Record<DietaryRestriction, string[]> = {
  none: [],
  nuts: ['nut', 'nuts', 'almond', 'walnut', 'pecan', 'cashew', 'hazelnut', 'pistachio', 'peanut'],
  dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'dairy'],
  eggs: ['egg', 'eggs'],
  seafood: ['fish', 'shrimp', 'prawn', 'salmon', 'tuna', 'shellfish', 'seafood', 'crab', 'lobster'],
  gluten: ['wheat', 'flour', 'bread', 'pasta', 'gluten'],
  other: [],
};

function violatesRestrictions(
  recipe: Recipe,
  restrictions: DietaryRestriction[],
  otherAllergies: string[],
): boolean {
  if (!restrictions.length && !otherAllergies.length) return false;
  const keywords = recipeKeywords(recipe);
  for (const r of restrictions) {
    if (r === 'none') continue;
    const kws = RESTRICTION_KEYWORDS[r] ?? [];
    if (kws.some((k) => keywords.has(k))) return true;
  }
  for (const raw of otherAllergies) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    if (keywords.has(token)) return true;
  }
  return false;
}

function filterByRestrictions(recipes: Recipe[], profile: UserProfile | null): Recipe[] {
  if (!profile) return recipes;
  const restrictions = profile.dietaryRestrictions ?? [];
  const other = profile.otherAllergy ?? [];
  if (!restrictions.length && !other.length) return recipes;
  return recipes.filter((r) => !violatesRestrictions(r, restrictions, other));
}

function scoreForYou(
  recipe: Recipe,
  profile: UserProfile | null,
  seen: SeenMap,
): number {
  let score = 0;
  if (recipe.difficulty === 'easy') score += 2;
  if ((recipe.totalTime ?? 99) <= 45) score += 1;

  // Cuisine match
  const cuisines = (profile?.cuisinePreferences ?? []).map((c) => c.toLowerCase());
  if (cuisines.length) {
    const keywords = recipeKeywords(recipe);
    if (cuisines.some((c) => keywords.has(c))) score += 3;
  }

  // Diet type match (soft signal)
  const dietTypes = (profile?.dietTypes ?? []).map((d) => d.toLowerCase());
  if (dietTypes.length) {
    const tagNames = new Set((recipe.tags ?? []).map((t) => t.name.toLowerCase()));
    if (dietTypes.some((d) => tagNames.has(d))) score += 1;
  }

  // Rotation penalty — seen within 7 days
  const seenAt = seen[recipe.id];
  if (seenAt && Date.now() - seenAt < SEEN_TTL_MS) score -= 5;

  return score;
}

async function loadSeenMap(): Promise<SeenMap> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SeenMap;
    // Prune expired entries opportunistically
    const now = Date.now();
    for (const [k, ts] of Object.entries(parsed)) {
      if (now - ts > SEEN_TTL_MS) delete parsed[k];
    }
    return parsed;
  } catch {
    return {};
  }
}

async function persistSeenMap(ids: string[]): Promise<void> {
  try {
    const existing = await loadSeenMap();
    const now = Date.now();
    for (const id of ids) existing[id] = now;
    await AsyncStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Non-fatal — silence.
  }
}

function pickUpcomingSlot(plan: MealPlan | null): MealPlanSlot | null {
  if (!plan) return null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = plan.slots
    .filter((s) => s.status === 'planned')
    .filter((s) => s.plannedDate >= todayIso)
    .sort((a, b) => {
      if (a.plannedDate === b.plannedDate) {
        return a.displayOrder - b.displayOrder;
      }
      return a.plannedDate.localeCompare(b.plannedDate);
    });
  return upcoming[0] ?? null;
}

/**
 * Build a synthetic Recipe-lite from a slot's primary component so we can
 * render it through the existing RecipeSectionList / WatercolorRecipeCard
 * without pulling the full recipe detail. Only the fields the card reads are
 * populated.
 */
function slotToRecipe(slot: MealPlanSlot): Recipe | null {
  const primary = slot.components.find((c) => c.isPrimary) ?? slot.components[0];
  if (!primary || !primary.recipeId) return null;
  return {
    id: primary.recipeId,
    name: primary.title,
    pictureUrl: primary.imageUrl ?? undefined,
    difficulty: (primary.difficulty ?? 'easy') as Recipe['difficulty'],
    prepTime: null,
    totalTime: primary.totalTimeMinutes ?? null,
    portions: primary.portions ?? undefined,
    ingredients: [],
    tags: [],
    steps: [],
    isPublished: true,
    createdAt: '',
    updatedAt: '',
  };
}

export interface UsePersonalizedSectionsArgs {
  recipes: Recipe[];
  userProfile: UserProfile | null;
  activePlan?: MealPlan | null;
  /** Map of recipeId -> cook count. Optional; favourites section is hidden when empty. */
  cookCounts?: Record<string, number>;
}

export function usePersonalizedSections({
  recipes,
  userProfile,
  activePlan = null,
  cookCounts = {},
}: UsePersonalizedSectionsArgs): RecipeSection[] {
  const seenRef = useRef<SeenMap>({});

  // Load the "seen within 7 days" map once per mount.
  useEffect(() => {
    let cancelled = false;
    loadSeenMap().then((map) => {
      if (!cancelled) seenRef.current = map;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo<RecipeSection[]>(() => {
    const safeRecipes = filterByRestrictions(recipes, userProfile);

    const sections: RecipeSection[] = [];
    const usedIds = new Set<string>();

    // Today's Meal (requires plan)
    const upcoming = pickUpcomingSlot(activePlan ?? null);
    const upcomingRecipe = upcoming ? slotToRecipe(upcoming) : null;
    if (upcomingRecipe) {
      sections.push({
        id: 'todays_meal',
        title: i18n.t('recipes.sections.todays_meal'),
        recipes: [upcomingRecipe],
        layout: 'horizontal',
      });
      usedIds.add(upcomingRecipe.id);
    }

    // For You — ranked, capped at 10, dedup against used
    const forYouPool = safeRecipes.filter((r) => !usedIds.has(r.id));
    const ranked = [...forYouPool]
      .map((r) => ({
        recipe: r,
        score: scoreForYou(r, userProfile, seenRef.current),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((x) => x.recipe);
    if (ranked.length) {
      sections.push({
        id: 'for_you',
        title: i18n.t('recipes.sections.for_you'),
        recipes: ranked,
        layout: 'horizontal',
      });
      ranked.forEach((r) => usedIds.add(r.id));
      // Fire-and-forget: mark seen so the next visit rotates different recipes.
      void persistSeenMap(ranked.map((r) => r.id));
    }

    // Favourites — cooked 3+ times
    // TODO(plan-10): wire to `recipe_cook_events` / user stats once available.
    const favouriteIds = Object.entries(cookCounts)
      .filter(([, n]) => n >= 3)
      .map(([id]) => id);
    if (favouriteIds.length) {
      const favs = safeRecipes
        .filter((r) => favouriteIds.includes(r.id) && !usedIds.has(r.id))
        .slice(0, 10);
      if (favs.length) {
        sections.push({
          id: 'favourites',
          title: i18n.t('recipes.sections.favourites'),
          recipes: favs,
          layout: 'horizontal',
        });
        favs.forEach((r) => usedIds.add(r.id));
      }
    }

    // Quick & Easy — <=30min and easy
    const quick = safeRecipes
      .filter(
        (r) =>
          !usedIds.has(r.id) &&
          r.totalTime != null &&
          r.totalTime <= 30 &&
          r.difficulty === 'easy',
      )
      .slice(0, 10);
    if (quick.length) {
      sections.push({
        id: 'quick_easy',
        title: i18n.t('recipes.sections.quick_easy'),
        recipes: quick,
        layout: 'horizontal',
      });
      quick.forEach((r) => usedIds.add(r.id));
    }

    // Worth a Try — 1 card from an underexplored cuisine. Hidden in first-week
    // trust mode (no cook history). Uses the user's preferred cuisines as a
    // weak proxy for "already explored" — picks the first recipe whose tokens
    // do NOT match any preferred cuisine.
    const hasHistory = Object.keys(cookCounts).length > 0;
    if (hasHistory) {
      const preferred = new Set(
        (userProfile?.cuisinePreferences ?? []).map((c) => c.toLowerCase()),
      );
      const candidate = safeRecipes.find((r) => {
        if (usedIds.has(r.id)) return false;
        const kws = recipeKeywords(r);
        return ![...preferred].some((c) => kws.has(c));
      });
      if (candidate) {
        sections.push({
          id: 'worth_a_try',
          title: i18n.t('recipes.sections.worth_a_try'),
          recipes: [candidate],
          layout: 'horizontal',
        });
        usedIds.add(candidate.id);
      }
    }

    // Popular — requires rating data we don't have on Recipe yet. Hidden
    // until the ratings feature lands.
    // TODO(plan-11): surface `average_rating >= 4.0 AND rating_count >= 10`.

    // All Recipes — full paginated grid (restriction-filtered by default)
    if (safeRecipes.length) {
      sections.push({
        id: 'all_recipes',
        title: i18n.t('recipes.sections.all'),
        recipes: safeRecipes,
        layout: 'grid',
      });
    }

    return sections;
  }, [recipes, userProfile, activePlan, cookCounts]);
}

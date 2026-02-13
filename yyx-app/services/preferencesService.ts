/**
 * Preferences Service
 *
 * Fetches food preference options from the database.
 * Used by onboarding and profile settings to display available options.
 */

import { supabase } from '@/lib/supabase';
import { PreferenceOption } from '@/types/dietary';
import { BaseService } from './base/BaseService';

type Language = 'en' | 'es';

interface RawPreferenceRow {
  id: string;
  slug: string;
  name_en: string;
  name_es: string;
  icon_name: string | null;
}

class PreferencesService extends BaseService {
  /**
   * Transform a raw database row into a PreferenceOption.
   * Selects the localized name based on the provided language.
   */
  private transformToOption(row: RawPreferenceRow, language: Language): PreferenceOption {
    return {
      id: row.id,
      slug: row.slug,
      name: language === 'es' ? row.name_es : row.name_en,
      iconName: row.icon_name ?? undefined,
    };
  }

  /**
   * Fetch options from a preference table, sorted alphabetically by localized name.
   */
  private async fetchPreferences(table: string, language: Language): Promise<PreferenceOption[]> {
    const { data, error } = await this.supabase
      .from(table)
      .select('id, slug, name_en, name_es, icon_name');

    if (error) {
      console.error(`Failed to fetch ${table}:`, error);
      throw error;
    }

    if (!data) return [];

    return data
      .map((row) => this.transformToOption(row as RawPreferenceRow, language))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Fetch all food allergy options.
   * These represent allergen categories (nuts, dairy, gluten, etc.)
   */
  async getFoodAllergies(language: Language): Promise<PreferenceOption[]> {
    return this.fetchPreferences('food_allergies', language);
  }

  /**
   * Fetch all diet type options.
   * These represent eating approaches (vegan, keto, paleo, etc.)
   * Does NOT include cuisines like mediterranean.
   */
  async getDietTypes(language: Language): Promise<PreferenceOption[]> {
    return this.fetchPreferences('diet_types', language);
  }

  /**
   * Fetch all cuisine preference options.
   * These represent cooking styles (Italian, Mexican, Mediterranean, etc.)
   * These are SOFT preferences that inspire recipe generation.
   */
  async getCuisinePreferences(language: Language): Promise<PreferenceOption[]> {
    return this.fetchPreferences('cuisine_preferences', language);
  }

  /**
   * Fetch all preference options in parallel.
   * Useful for preloading all options at once.
   */
  async getAllPreferences(language: Language): Promise<{
    foodAllergies: PreferenceOption[];
    dietTypes: PreferenceOption[];
    cuisinePreferences: PreferenceOption[];
  }> {
    const [foodAllergies, dietTypes, cuisinePreferences] = await Promise.all([
      this.getFoodAllergies(language),
      this.getDietTypes(language),
      this.getCuisinePreferences(language),
    ]);

    return {
      foodAllergies,
      dietTypes,
      cuisinePreferences,
    };
  }
}

export const preferencesService = new PreferencesService(supabase);
export default preferencesService;

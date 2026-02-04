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
  display_order: number;
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
      displayOrder: row.display_order,
    };
  }

  /**
   * Fetch all food allergy options.
   * These represent allergen categories (nuts, dairy, gluten, etc.)
   */
  async getFoodAllergies(language: Language): Promise<PreferenceOption[]> {
    const { data, error } = await this.supabase
      .from('food_allergies')
      .select('id, slug, name_en, name_es, icon_name, display_order')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch food allergies:', error);
      throw error;
    }

    if (!data) return [];

    return data.map((row) => this.transformToOption(row as RawPreferenceRow, language));
  }

  /**
   * Fetch all diet type options.
   * These represent eating approaches (vegan, keto, paleo, etc.)
   * Does NOT include cuisines like mediterranean.
   */
  async getDietTypes(language: Language): Promise<PreferenceOption[]> {
    const { data, error } = await this.supabase
      .from('diet_types')
      .select('id, slug, name_en, name_es, icon_name, display_order')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch diet types:', error);
      throw error;
    }

    if (!data) return [];

    return data.map((row) => this.transformToOption(row as RawPreferenceRow, language));
  }

  /**
   * Fetch all cuisine preference options.
   * These represent cooking styles (Italian, Mexican, Mediterranean, etc.)
   * These are SOFT preferences that inspire recipe generation.
   */
  async getCuisinePreferences(language: Language): Promise<PreferenceOption[]> {
    const { data, error } = await this.supabase
      .from('cuisine_preferences')
      .select('id, slug, name_en, name_es, icon_name, display_order')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch cuisine preferences:', error);
      throw error;
    }

    if (!data) return [];

    return data.map((row) => this.transformToOption(row as RawPreferenceRow, language));
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

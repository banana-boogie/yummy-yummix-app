import { supabase } from '@/lib/supabase';
import { NutritionalFacts } from '@/types/recipe.admin.types';

export class NutritionalFactsService {
  static async fetchNutritionalFacts(ingredientName: string): Promise<NutritionalFacts> {
    const { data, error } = await supabase.functions.invoke('get-nutritional-facts', {
      body: { ingredientName },
    });

    if (error) {
      throw new Error(`Failed to fetch nutritional facts: ${error.message}`);
    }

    // Edge function returns { per_100g: { calories, protein, fat, carbohydrates } }
    // Unwrap to flat shape for the new NutritionalFacts interface
    const raw = data?.per_100g ?? data;
    if (
      !raw ||
      typeof raw.calories !== 'number' ||
      typeof raw.protein !== 'number' ||
      typeof raw.fat !== 'number' ||
      typeof raw.carbohydrates !== 'number'
    ) {
      throw new Error('Invalid nutrition data received');
    }

    return {
      calories: raw.calories,
      protein: raw.protein,
      fat: raw.fat,
      carbohydrates: raw.carbohydrates,
    };
  }
}

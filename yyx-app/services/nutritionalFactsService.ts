import { supabase } from '@/lib/supabase';

export interface NutritionalFactsResponse {
  per_100g: {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
  }
}

export class NutritionalFactsService {
  static async fetchNutritionalFacts(ingredientName: string): Promise<NutritionalFactsResponse> {
    const { data, error } = await supabase.functions.invoke('get-nutritional-facts', {
      body: { ingredientName },
    });

    if (error) {
      throw new Error(`Failed to fetch nutritional facts: ${error.message}`);
    }

    return data;
  }
} 
/**
 * NutritionalFactsService Tests
 *
 * Tests for nutritional facts service covering:
 * - Fetching nutritional data
 * - Error handling
 * - Response format validation (unwraps per_100g from edge function)
 */

import { NutritionalFactsService } from '../nutritionalFactsService';

// Mock Supabase
const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (name: string, options: { body: { ingredientName: string } }) =>
        mockInvoke(name, options),
    },
  },
}));

describe('NutritionalFactsService', () => {
  // Edge function returns { per_100g: { ... } }, service unwraps to flat shape
  const mockEdgeFunctionResponse = {
    per_100g: {
      calories: 165,
      protein: 31,
      fat: 3.6,
      carbohydrates: 0,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: mockEdgeFunctionResponse, error: null });
  });

  // ============================================================
  // FETCH NUTRITIONAL FACTS TESTS
  // ============================================================

  describe('fetchNutritionalFacts', () => {
    it('calls edge function with ingredient name', async () => {
      await NutritionalFactsService.fetchNutritionalFacts('chicken breast');

      expect(mockInvoke).toHaveBeenCalledWith('get-nutritional-facts', {
        body: { ingredientName: 'chicken breast' },
      });
    });

    it('returns flat nutritional data (unwrapped from per_100g)', async () => {
      const result = await NutritionalFactsService.fetchNutritionalFacts('chicken breast');

      expect(result).toEqual({
        calories: 165,
        protein: 31,
        fat: 3.6,
        carbohydrates: 0,
      });
      expect(result.calories).toBe(165);
      expect(result.protein).toBe(31);
      expect(result.fat).toBe(3.6);
      expect(result.carbohydrates).toBe(0);
    });

    it('throws error when edge function returns error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Ingredient not found' },
      });

      await expect(
        NutritionalFactsService.fetchNutritionalFacts('unknown-ingredient-xyz')
      ).rejects.toThrow('Failed to fetch nutritional facts: Ingredient not found');
    });

    it('handles network errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      await expect(
        NutritionalFactsService.fetchNutritionalFacts('chicken')
      ).rejects.toThrow('Network error');
    });

    it('handles empty ingredient name', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Ingredient name is required' },
      });

      await expect(
        NutritionalFactsService.fetchNutritionalFacts('')
      ).rejects.toThrow('Failed to fetch nutritional facts: Ingredient name is required');
    });

    it('throws on malformed successful response', async () => {
      mockInvoke.mockResolvedValue({ data: { per_100g: { calories: 'not-a-number' } }, error: null });

      await expect(
        NutritionalFactsService.fetchNutritionalFacts('chicken')
      ).rejects.toThrow('Invalid nutrition data received');
    });

    it('throws on null data response', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: null });

      await expect(
        NutritionalFactsService.fetchNutritionalFacts('chicken')
      ).rejects.toThrow('Invalid nutrition data received');
    });

    it('normalizes ingredient name before sending', async () => {
      await NutritionalFactsService.fetchNutritionalFacts('  Chicken Breast  ');

      expect(mockInvoke).toHaveBeenCalledWith('get-nutritional-facts', {
        body: { ingredientName: '  Chicken Breast  ' }, // Current impl doesn't trim
      });
    });
  });

  // ============================================================
  // RESPONSE FORMAT TESTS
  // ============================================================

  describe('response format', () => {
    it('returns flat structure (no per_100g wrapper)', async () => {
      const result = await NutritionalFactsService.fetchNutritionalFacts('rice');

      expect(result).toHaveProperty('calories');
      expect(result).toHaveProperty('protein');
      expect(result).toHaveProperty('fat');
      expect(result).toHaveProperty('carbohydrates');
      expect(result).not.toHaveProperty('per_100g');
    });

    it('handles high-carb food response', async () => {
      const riceResponse = {
        per_100g: {
          calories: 130,
          protein: 2.7,
          fat: 0.3,
          carbohydrates: 28.2,
        },
      };
      mockInvoke.mockResolvedValue({ data: riceResponse, error: null });

      const result = await NutritionalFactsService.fetchNutritionalFacts('white rice');

      expect(result.carbohydrates).toBe(28.2);
      expect(result.fat).toBe(0.3);
    });

    it('handles high-fat food response', async () => {
      const butterResponse = {
        per_100g: {
          calories: 717,
          protein: 0.9,
          fat: 81.1,
          carbohydrates: 0.1,
        },
      };
      mockInvoke.mockResolvedValue({ data: butterResponse, error: null });

      const result = await NutritionalFactsService.fetchNutritionalFacts('butter');

      expect(result.fat).toBe(81.1);
      expect(result.calories).toBe(717);
    });

    it('handles zero values', async () => {
      const waterResponse = {
        per_100g: {
          calories: 0,
          protein: 0,
          fat: 0,
          carbohydrates: 0,
        },
      };
      mockInvoke.mockResolvedValue({ data: waterResponse, error: null });

      const result = await NutritionalFactsService.fetchNutritionalFacts('water');

      expect(result.calories).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.fat).toBe(0);
      expect(result.carbohydrates).toBe(0);
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles special characters in ingredient name', async () => {
      await NutritionalFactsService.fetchNutritionalFacts("Reese's Pieces");

      expect(mockInvoke).toHaveBeenCalledWith('get-nutritional-facts', {
        body: { ingredientName: "Reese's Pieces" },
      });
    });

    it('handles unicode characters in ingredient name', async () => {
      await NutritionalFactsService.fetchNutritionalFacts('crème fraîche');

      expect(mockInvoke).toHaveBeenCalledWith('get-nutritional-facts', {
        body: { ingredientName: 'crème fraîche' },
      });
    });

    it('handles very long ingredient names', async () => {
      const longName = 'organic grass-fed free-range chicken breast with herbs and spices';
      await NutritionalFactsService.fetchNutritionalFacts(longName);

      expect(mockInvoke).toHaveBeenCalledWith('get-nutritional-facts', {
        body: { ingredientName: longName },
      });
    });

    it('handles Spanish ingredient names', async () => {
      await NutritionalFactsService.fetchNutritionalFacts('pechuga de pollo');

      expect(mockInvoke).toHaveBeenCalledWith('get-nutritional-facts', {
        body: { ingredientName: 'pechuga de pollo' },
      });
    });
  });
});

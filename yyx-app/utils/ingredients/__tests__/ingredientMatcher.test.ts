import { IngredientMatcher } from '@/utils/ingredients/ingredientMatcher';

describe('IngredientMatcher', () => {
  const matcher = new IngredientMatcher();

  // Helper to build minimal ingredient objects with translations
  const makeIngredient = (name: string) => ({
    id: '1',
    translations: [{ locale: 'en', name }],
  });

  const makeStepIngredient = (name: string) => ({
    ingredient: {
      id: '1',
      translations: [{ locale: 'en', name }],
    },
  });

  describe('findMatch - unit suffix stripping', () => {
    it('matches "rosemary sprig" to "rosemary"', () => {
      const search = makeStepIngredient('rosemary sprig');
      const available = [makeIngredient('rosemary')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "garlic clove" to "garlic"', () => {
      const search = makeStepIngredient('garlic clove');
      const available = [makeIngredient('garlic')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "garlic cloves" to "garlic"', () => {
      const search = makeStepIngredient('garlic cloves');
      const available = [makeIngredient('garlic')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "basil leaves" to "basil"', () => {
      const search = makeStepIngredient('basil leaves');
      const available = [makeIngredient('basil')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "bread slice" to "bread"', () => {
      const search = makeStepIngredient('bread slice');
      const available = [makeIngredient('bread')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "cheese cubes" to "cheese"', () => {
      const search = makeStepIngredient('cheese cubes');
      const available = [makeIngredient('cheese')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });
  });

  describe('findMatch - leading "unit of" pattern stripping (English)', () => {
    it('matches "sprig of rosemary" to "rosemary"', () => {
      const search = makeStepIngredient('sprig of rosemary');
      const available = [makeIngredient('rosemary')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "clove of garlic" to "garlic"', () => {
      const search = makeStepIngredient('clove of garlic');
      const available = [makeIngredient('garlic')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "slice of bread" to "bread"', () => {
      const search = makeStepIngredient('slice of bread');
      const available = [makeIngredient('bread')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });
  });

  describe('findMatch - leading "unit of" pattern stripping (Spanish)', () => {
    it('matches "ramita de romero" to "romero"', () => {
      const search = makeStepIngredient('ramita de romero');
      const available = [makeIngredient('romero')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "diente de ajo" to "ajo"', () => {
      const search = makeStepIngredient('diente de ajo');
      const available = [makeIngredient('ajo')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "hoja de laurel" to "laurel"', () => {
      const search = makeStepIngredient('hoja de laurel');
      const available = [makeIngredient('laurel')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "trozo de queso" to "queso"', () => {
      const search = makeStepIngredient('trozo de queso');
      const available = [makeIngredient('queso')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches "pizca de sal" to "sal"', () => {
      const search = makeStepIngredient('pizca de sal');
      const available = [makeIngredient('sal')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });
  });

  describe('findMatch - combined prep prefix and unit stripping', () => {
    it('matches "fresh rosemary sprig" to "rosemary"', () => {
      const search = makeStepIngredient('fresh rosemary sprig');
      const available = [makeIngredient('rosemary')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });
  });

  describe('findMatch - exact match still works', () => {
    it('matches exact names', () => {
      const search = makeStepIngredient('rosemary');
      const available = [makeIngredient('rosemary')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });

    it('matches case-insensitively', () => {
      const search = makeStepIngredient('Rosemary');
      const available = [makeIngredient('rosemary')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).not.toBeNull();
    });
  });

  describe('findMatch - distinct ingredients still prevented', () => {
    it('does not match "sugar" to "brown sugar"', () => {
      const search = makeStepIngredient('sugar');
      const available = [makeIngredient('brown sugar')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).toBeNull();
    });
  });

  describe('findMatch - no false positives from unit stripping', () => {
    it('does not match "olive" to "olive oil"', () => {
      const search = makeStepIngredient('olive');
      const available = [makeIngredient('olive oil')];
      const result = matcher.findMatch(search as any, available as any);
      expect(result).toBeNull();
    });
  });
});

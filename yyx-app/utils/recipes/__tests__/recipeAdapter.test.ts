/**
 * recipeAdapter Tests
 *
 * Tests for adapting AI-generated recipes to the Recipe type used by cooking guide.
 */

import { adaptGeneratedRecipe } from '../recipeAdapter';
import { createMockGeneratedRecipe } from '@/test/mocks/chat';
import type { GeneratedRecipe } from '@/types/irmixy';

// We need to access internal functions for testing, so we re-export them
// or test through the public interface

describe('recipeAdapter', () => {
  // ============================================================
  // formatQuantity Tests (tested through adaptGeneratedRecipe)
  // ============================================================

  describe('quantity formatting', () => {
    it.each([
      [0.5, '1/2'],
      [0.33, '1/3'],
      [0.25, '1/4'],
      [0.67, '2/3'],
      [0.75, '3/4'],
      [1.5, '1 1/2'],
      [2, '2'],
      [1, '1'],
      [3, '3'],
    ])('formats quantity %s as "%s"', (quantity, expectedFormat) => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'test ingredient', quantity, unit: 'cups' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].formattedQuantity).toBe(expectedFormat);
    });

    it('handles mixed numbers correctly', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'flour', quantity: 2.5, unit: 'cups' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].formattedQuantity).toBe('2 1/2');
    });

    it('formats decimals without fraction match', () => {
      // 0.15 is far enough from any common fraction (0.25, 0.33, 0.5, 0.67, 0.75)
      // that it won't match (needs to be within 0.1 to match)
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'salt', quantity: 0.15, unit: 'tsp' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      // Should fall back to decimal format (0.15)
      expect(adapted.ingredients[0].formattedQuantity).toBe('0.15');
    });
  });

  // ============================================================
  // createMeasurementUnit Tests (tested through adaptGeneratedRecipe)
  // ============================================================

  describe('measurement unit creation', () => {
    it('creates volume unit for "cup"', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'water', quantity: 1, unit: 'cup' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('volume');
    });

    it('creates volume unit for "cups"', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'water', quantity: 2, unit: 'cups' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('volume');
    });

    it('creates volume unit for "tbsp"', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'oil', quantity: 2, unit: 'tbsp' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('volume');
    });

    it('creates volume unit for "tsp"', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'salt', quantity: 1, unit: 'tsp' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('volume');
    });

    it('creates volume unit for "ml"', () => {
      const recipe = createMockGeneratedRecipe({
        measurementSystem: 'metric',
        ingredients: [{ name: 'water', quantity: 100, unit: 'ml' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('volume');
    });

    it('creates weight unit for "lb"', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'chicken', quantity: 2, unit: 'lb' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('weight');
    });

    it('creates weight unit for "lbs"', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'beef', quantity: 3, unit: 'lbs' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('weight');
    });

    it('creates weight unit for "g"', () => {
      const recipe = createMockGeneratedRecipe({
        measurementSystem: 'metric',
        ingredients: [{ name: 'sugar', quantity: 100, unit: 'g' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('weight');
    });

    it('creates weight unit for "kg"', () => {
      const recipe = createMockGeneratedRecipe({
        measurementSystem: 'metric',
        ingredients: [{ name: 'flour', quantity: 1, unit: 'kg' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('weight');
    });

    it('creates weight unit for "ounces"', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'cheese', quantity: 8, unit: 'ounces' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('weight');
    });

    it('creates unit type for "cloves"', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'garlic', quantity: 3, unit: 'cloves' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('unit');
    });

    it('creates unit type for other units', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'eggs', quantity: 2, unit: 'large' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.type).toBe('unit');
    });

    it('respects imperial measurement system', () => {
      const recipe = createMockGeneratedRecipe({
        measurementSystem: 'imperial',
        ingredients: [{ name: 'flour', quantity: 2, unit: 'cups' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.system).toBe('imperial');
    });

    it('respects metric measurement system', () => {
      const recipe = createMockGeneratedRecipe({
        measurementSystem: 'metric',
        ingredients: [{ name: 'flour', quantity: 200, unit: 'g' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.system).toBe('metric');
    });

    it('sets universal system for empty unit', () => {
      const recipe = createMockGeneratedRecipe({
        ingredients: [{ name: 'eggs', quantity: 2, unit: '' }],
      });

      const adapted = adaptGeneratedRecipe(recipe, 'test-id', 'Test Recipe');

      expect(adapted.ingredients[0].measurementUnit.system).toBe('universal');
    });
  });

  // ============================================================
  // adaptGeneratedRecipe Tests
  // ============================================================

  describe('adaptGeneratedRecipe', () => {
    it('generates valid Recipe structure', () => {
      const generated = createMockGeneratedRecipe();

      const adapted = adaptGeneratedRecipe(generated, 'test-id-123', 'My Recipe');

      expect(adapted.id).toBe('test-id-123');
      expect(adapted.name).toBe('My Recipe');
      expect(adapted.difficulty).toBe('easy');
      expect(adapted.totalTime).toBe(30);
      expect(adapted.portions).toBe(4);
      expect(adapted.ingredients).toHaveLength(5);
      expect(adapted.steps).toHaveLength(3);
      expect(adapted.tags).toHaveLength(3);
    });

    it('creates synthetic UUIDs for ingredients', () => {
      const generated = createMockGeneratedRecipe();

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test Recipe');

      // Each ingredient should have a unique UUID-like ID
      adapted.ingredients.forEach((ingredient) => {
        expect(ingredient.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });

      // All IDs should be unique
      const ids = adapted.ingredients.map((i) => i.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('creates synthetic UUIDs for steps', () => {
      const generated = createMockGeneratedRecipe();

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test Recipe');

      adapted.steps.forEach((step) => {
        expect(step.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });

    it('maps difficulty correctly', () => {
      const difficulties: Array<'easy' | 'medium' | 'hard'> = [
        'easy',
        'medium',
        'hard',
      ];

      difficulties.forEach((difficulty) => {
        const generated = createMockGeneratedRecipe({ difficulty });
        const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

        expect(adapted.difficulty).toBe(difficulty);
      });
    });

    it('preserves portions and time', () => {
      const generated = createMockGeneratedRecipe({
        totalTime: 45,
        portions: 6,
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.totalTime).toBe(45);
      expect(adapted.portions).toBe(6);
    });

    it('formats ingredient quantities', () => {
      const generated = createMockGeneratedRecipe({
        ingredients: [
          { name: 'flour', quantity: 1.5, unit: 'cups' },
          { name: 'sugar', quantity: 0.5, unit: 'cup' },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.ingredients[0].formattedQuantity).toBe('1 1/2');
      expect(adapted.ingredients[1].formattedQuantity).toBe('1/2');
    });

    it('creates MeasurementUnit objects for each ingredient', () => {
      const generated = createMockGeneratedRecipe({
        ingredients: [
          { name: 'flour', quantity: 2, unit: 'cups' },
          { name: 'chicken', quantity: 1, unit: 'lb' },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.ingredients[0].measurementUnit).toMatchObject({
        name: 'cups',
        symbol: 'cups',
        symbolPlural: 'cups',
        type: 'volume',
      });

      expect(adapted.ingredients[1].measurementUnit).toMatchObject({
        name: 'lb',
        symbol: 'lb',
        symbolPlural: 'lb',
        type: 'weight',
      });
    });

    it('sets display order for ingredients', () => {
      const generated = createMockGeneratedRecipe({
        ingredients: [
          { name: 'flour', quantity: 2, unit: 'cups' },
          { name: 'sugar', quantity: 1, unit: 'cup' },
          { name: 'eggs', quantity: 2, unit: '' },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.ingredients[0].displayOrder).toBe(1);
      expect(adapted.ingredients[1].displayOrder).toBe(2);
      expect(adapted.ingredients[2].displayOrder).toBe(3);
    });

    it('preserves step order from generated recipe', () => {
      const generated = createMockGeneratedRecipe({
        steps: [
          { order: 1, instruction: 'First step' },
          { order: 2, instruction: 'Second step' },
          { order: 3, instruction: 'Third step' },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.steps[0].order).toBe(1);
      expect(adapted.steps[0].instruction).toBe('First step');
      expect(adapted.steps[1].order).toBe(2);
      expect(adapted.steps[2].order).toBe(3);
    });

    it('handles thermomix data in steps', () => {
      const generated = createMockGeneratedRecipe({
        steps: [
          {
            order: 1,
            instruction: 'Blend ingredients',
            thermomixTime: 30,
            thermomixTemp: '100°C',
            thermomixSpeed: '5',
          },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.steps[0].thermomix).toEqual({
        time: 30,
        temperature: 100,
        temperatureUnit: 'C',
        speed: { type: 'single', value: 5 },
        isBladeReversed: false,
      });
    });

    it('handles partial thermomix data (speed/temp without time)', () => {
      const generated = createMockGeneratedRecipe({
        steps: [
          {
            order: 1,
            instruction: 'Blend at speed 5',
            thermomixSpeed: '5',
            thermomixTemp: '100°C',
          },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.steps[0].thermomix).toEqual({
        time: null,
        temperature: 100,
        temperatureUnit: 'C',
        speed: { type: 'single', value: 5 },
        isBladeReversed: false,
      });
    });

    it('handles Varoma temperature', () => {
      const generated = createMockGeneratedRecipe({
        steps: [
          {
            order: 1,
            instruction: 'Steam ingredients',
            thermomixTime: 600,
            thermomixTemp: 'Varoma',
            thermomixSpeed: '1',
          },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.steps[0].thermomix).toEqual({
        time: 600,
        temperature: 'Varoma',
        temperatureUnit: 'C',
        speed: { type: 'single', value: 1 },
        isBladeReversed: false,
      });
    });

    it('handles Spoon speed', () => {
      const generated = createMockGeneratedRecipe({
        steps: [
          {
            order: 1,
            instruction: 'Stir gently',
            thermomixTime: 60,
            thermomixSpeed: 'Spoon',
          },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.steps[0].thermomix).toEqual({
        time: 60,
        temperature: null,
        temperatureUnit: 'C',
        speed: { type: 'single', value: 'spoon' },
        isBladeReversed: false,
      });
    });

    it('handles Reverse speed indicator', () => {
      const generated = createMockGeneratedRecipe({
        steps: [
          {
            order: 1,
            instruction: 'Mix in reverse',
            thermomixTime: 30,
            thermomixSpeed: 'Reverse',
          },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.steps[0].thermomix).toEqual({
        time: 30,
        temperature: null,
        temperatureUnit: 'C',
        speed: { type: 'single', value: null },
        isBladeReversed: true,
      });
    });

    it('sets thermomix to undefined when not present', () => {
      const generated = createMockGeneratedRecipe({
        steps: [{ order: 1, instruction: 'Regular step' }],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.steps[0].thermomix).toBeUndefined();
    });

    it('creates tags with synthetic IDs', () => {
      const generated = createMockGeneratedRecipe({
        tags: ['italian', 'pasta', 'quick'],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.tags).toHaveLength(3);
      expect(adapted.tags[0].name).toBe('italian');
      expect(adapted.tags[1].name).toBe('pasta');
      expect(adapted.tags[2].name).toBe('quick');

      // Each tag should have a UUID
      adapted.tags.forEach((tag) => {
        expect(tag.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });

    it('transforms useful items with synthetic IDs', () => {
      const generated = createMockGeneratedRecipe({
        usefulItems: [
          { name: 'Spatula', imageUrl: 'https://example.com/spatula.jpg', notes: 'For stirring' },
          { name: 'Thermometer' },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.usefulItems).toHaveLength(2);
      expect(adapted.usefulItems![0].name).toBe('Spatula');
      expect(adapted.usefulItems![0].pictureUrl).toBe('https://example.com/spatula.jpg');
      expect(adapted.usefulItems![0].notes).toBe('For stirring');
      expect(adapted.usefulItems![0].displayOrder).toBe(1);
      expect(adapted.usefulItems![1].name).toBe('Thermometer');
      expect(adapted.usefulItems![1].pictureUrl).toBe('');
      expect(adapted.usefulItems![1].notes).toBe('');
      expect(adapted.usefulItems![1].displayOrder).toBe(2);

      // Each item should have a UUID
      adapted.usefulItems!.forEach((item) => {
        expect(item.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });

    it('handles empty useful items', () => {
      const generated = createMockGeneratedRecipe({
        usefulItems: [],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.usefulItems).toEqual([]);
    });

    it('handles undefined useful items', () => {
      const generated = createMockGeneratedRecipe();
      delete (generated as Record<string, unknown>).usefulItems;

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.usefulItems).toEqual([]);
    });

    it('sets isPublished to false', () => {
      const generated = createMockGeneratedRecipe();

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.isPublished).toBe(false);
    });

    it('sets timestamps', () => {
      const before = new Date().toISOString();
      const generated = createMockGeneratedRecipe();

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      const after = new Date().toISOString();

      expect(adapted.createdAt).toBeDefined();
      expect(adapted.updatedAt).toBeDefined();
      expect(adapted.createdAt >= before).toBe(true);
      expect(adapted.updatedAt <= after).toBe(true);
    });

    it('sets pictureUrl to undefined', () => {
      const generated = createMockGeneratedRecipe();

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.pictureUrl).toBeUndefined();
    });

    it('preserves ingredient imageUrl when present', () => {
      const generated = createMockGeneratedRecipe({
        ingredients: [
          {
            name: 'chicken',
            quantity: 1,
            unit: 'lb',
            imageUrl: 'https://example.com/chicken.jpg',
          },
        ],
      });

      const adapted = adaptGeneratedRecipe(generated, 'test-id', 'Test');

      expect(adapted.ingredients[0].pictureUrl).toBe(
        'https://example.com/chicken.jpg'
      );
    });
  });

  // ============================================================
  // validateGeneratedRecipe Tests (tested through adaptGeneratedRecipe)
  // ============================================================

  describe('validation', () => {
    it('throws for missing ingredients', () => {
      const generated = {
        schemaVersion: '1.0',
        suggestedName: 'Test',
        measurementSystem: 'imperial',
        language: 'en',
        ingredients: undefined, // Missing!
        steps: [{ order: 1, instruction: 'Test' }],
        totalTime: 30,
        difficulty: 'easy',
        portions: 4,
        tags: [],
      } as unknown as GeneratedRecipe;

      expect(() => adaptGeneratedRecipe(generated, 'test-id', 'Test')).toThrow(
        'missing ingredients'
      );
    });

    it('throws for missing steps', () => {
      const generated = {
        schemaVersion: '1.0',
        suggestedName: 'Test',
        measurementSystem: 'imperial',
        language: 'en',
        ingredients: [{ name: 'test', quantity: 1, unit: 'cup' }],
        steps: undefined, // Missing!
        totalTime: 30,
        difficulty: 'easy',
        portions: 4,
        tags: [],
      } as unknown as GeneratedRecipe;

      expect(() => adaptGeneratedRecipe(generated, 'test-id', 'Test')).toThrow(
        'missing steps'
      );
    });

    it('throws for missing totalTime', () => {
      const generated = {
        schemaVersion: '1.0',
        suggestedName: 'Test',
        measurementSystem: 'imperial',
        language: 'en',
        ingredients: [{ name: 'test', quantity: 1, unit: 'cup' }],
        steps: [{ order: 1, instruction: 'Test' }],
        totalTime: undefined, // Missing!
        difficulty: 'easy',
        portions: 4,
        tags: [],
      } as unknown as GeneratedRecipe;

      expect(() => adaptGeneratedRecipe(generated, 'test-id', 'Test')).toThrow(
        'totalTime'
      );
    });

    it('throws for negative totalTime', () => {
      const generated = {
        schemaVersion: '1.0',
        suggestedName: 'Test',
        measurementSystem: 'imperial',
        language: 'en',
        ingredients: [{ name: 'test', quantity: 1, unit: 'cup' }],
        steps: [{ order: 1, instruction: 'Test' }],
        totalTime: -10,
        difficulty: 'easy',
        portions: 4,
        tags: [],
      } as unknown as GeneratedRecipe;

      expect(() => adaptGeneratedRecipe(generated, 'test-id', 'Test')).toThrow(
        'totalTime'
      );
    });

    it('throws for invalid difficulty', () => {
      const generated = {
        schemaVersion: '1.0',
        suggestedName: 'Test',
        measurementSystem: 'imperial',
        language: 'en',
        ingredients: [{ name: 'test', quantity: 1, unit: 'cup' }],
        steps: [{ order: 1, instruction: 'Test' }],
        totalTime: 30,
        difficulty: 'expert', // Invalid!
        portions: 4,
        tags: [],
      } as unknown as GeneratedRecipe;

      expect(() => adaptGeneratedRecipe(generated, 'test-id', 'Test')).toThrow(
        'difficulty'
      );
    });

    it('throws for invalid measurementSystem', () => {
      const generated = {
        schemaVersion: '1.0',
        suggestedName: 'Test',
        measurementSystem: 'australian', // Invalid!
        language: 'en',
        ingredients: [{ name: 'test', quantity: 1, unit: 'cup' }],
        steps: [{ order: 1, instruction: 'Test' }],
        totalTime: 30,
        difficulty: 'easy',
        portions: 4,
        tags: [],
      } as unknown as GeneratedRecipe;

      expect(() => adaptGeneratedRecipe(generated, 'test-id', 'Test')).toThrow(
        'measurementSystem'
      );
    });

    it('throws for portions less than 1', () => {
      const generated = {
        schemaVersion: '1.0',
        suggestedName: 'Test',
        measurementSystem: 'imperial',
        language: 'en',
        ingredients: [{ name: 'test', quantity: 1, unit: 'cup' }],
        steps: [{ order: 1, instruction: 'Test' }],
        totalTime: 30,
        difficulty: 'easy',
        portions: 0, // Invalid!
        tags: [],
      } as unknown as GeneratedRecipe;

      expect(() => adaptGeneratedRecipe(generated, 'test-id', 'Test')).toThrow(
        'portions'
      );
    });

    it('accepts valid recipe', () => {
      const generated = createMockGeneratedRecipe();

      expect(() =>
        adaptGeneratedRecipe(generated, 'test-id', 'Test')
      ).not.toThrow();
    });
  });
});

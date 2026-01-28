/**
 * Equipment Constants Tests
 *
 * Tests for kitchen equipment configuration and helper functions.
 */

import {
  EQUIPMENT_CONFIG,
  formatEquipmentForStorage,
  parseEquipmentString,
  type EquipmentType,
  type ThermomixModel,
} from '../equipment';

describe('EQUIPMENT_CONFIG', () => {
  it('should have thermomix configuration', () => {
    expect(EQUIPMENT_CONFIG.thermomix).toBeDefined();
    expect(EQUIPMENT_CONFIG.thermomix.id).toBe('thermomix');
    expect(EQUIPMENT_CONFIG.thermomix.hasModels).toBe(true);
    expect(EQUIPMENT_CONFIG.thermomix.models).toHaveLength(3);
  });

  it('should have air_fryer configuration', () => {
    expect(EQUIPMENT_CONFIG.air_fryer).toBeDefined();
    expect(EQUIPMENT_CONFIG.air_fryer.id).toBe('air_fryer');
    expect(EQUIPMENT_CONFIG.air_fryer.hasModels).toBe(false);
  });

  it('should have valid Thermomix models', () => {
    const { models } = EQUIPMENT_CONFIG.thermomix;
    expect(models).toContain('TM5');
    expect(models).toContain('TM6');
    expect(models).toContain('TM7');
  });
});

describe('formatEquipmentForStorage', () => {
  it('should format thermomix with model', () => {
    const result = formatEquipmentForStorage('thermomix', 'TM6');
    expect(result).toBe('thermomix_TM6');
  });

  it('should format thermomix without model', () => {
    const result = formatEquipmentForStorage('thermomix');
    expect(result).toBe('thermomix');
  });

  it('should format air_fryer without model', () => {
    const result = formatEquipmentForStorage('air_fryer');
    expect(result).toBe('air_fryer');
  });

  it('should handle all Thermomix models', () => {
    expect(formatEquipmentForStorage('thermomix', 'TM5')).toBe('thermomix_TM5');
    expect(formatEquipmentForStorage('thermomix', 'TM6')).toBe('thermomix_TM6');
    expect(formatEquipmentForStorage('thermomix', 'TM7')).toBe('thermomix_TM7');
  });
});

describe('parseEquipmentString', () => {
  it('should parse thermomix with model', () => {
    const result = parseEquipmentString('thermomix_TM6');
    expect(result.type).toBe('thermomix');
    expect(result.model).toBe('TM6');
  });

  it('should parse thermomix without model', () => {
    const result = parseEquipmentString('thermomix');
    expect(result.type).toBe('thermomix');
    expect(result.model).toBeUndefined();
  });

  it('should parse air_fryer', () => {
    const result = parseEquipmentString('air_fryer');
    expect(result.type).toBe('air_fryer');
    expect(result.model).toBeUndefined();
  });

  it('should parse all Thermomix models', () => {
    expect(parseEquipmentString('thermomix_TM5')).toEqual({
      type: 'thermomix',
      model: 'TM5',
    });
    expect(parseEquipmentString('thermomix_TM6')).toEqual({
      type: 'thermomix',
      model: 'TM6',
    });
    expect(parseEquipmentString('thermomix_TM7')).toEqual({
      type: 'thermomix',
      model: 'TM7',
    });
  });

  it('should handle round-trip conversion', () => {
    const original = { type: 'thermomix' as EquipmentType, model: 'TM6' as ThermomixModel };
    const formatted = formatEquipmentForStorage(original.type, original.model);
    const parsed = parseEquipmentString(formatted);

    expect(parsed).toEqual(original);
  });
});

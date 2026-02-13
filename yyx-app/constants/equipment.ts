/**
 * Kitchen Equipment Configuration
 *
 * Defines available kitchen equipment for onboarding and recipe personalization.
 * Icons can be replaced with custom images later by updating this file.
 *
 * NOTE: YummyYummix is a Thermomix-first app, so Thermomix should be prominently featured.
 */

export const EQUIPMENT_CONFIG = {
  thermomix: {
    id: 'thermomix',
    icon: '🤖', // TODO: Replace with custom SVG/PNG icon from designer
    models: ['TM5', 'TM6', 'TM7'] as const,
    hasModels: true,
  },
  air_fryer: {
    id: 'air_fryer',
    icon: '🍟', // TODO: Replace with custom SVG/PNG icon from designer
    models: [] as const,
    hasModels: false,
  },
} as const;

export type EquipmentType = keyof typeof EQUIPMENT_CONFIG;
export type ThermomixModel = typeof EQUIPMENT_CONFIG.thermomix.models[number];

/**
 * Format equipment for storage in database.
 * Thermomix includes model (e.g., "thermomix_TM6"), others are just the type.
 */
export function formatEquipmentForStorage(
  type: EquipmentType,
  model?: ThermomixModel
): string {
  if (type === 'thermomix' && model) {
    return `${type}_${model}`;
  }
  return type;
}

/**
 * Parse equipment string from database.
 * Returns { type, model } where model is only set for Thermomix.
 */
export function parseEquipmentString(equipment: string): {
  type: EquipmentType;
  model?: ThermomixModel;
} {
  if (equipment.startsWith('thermomix_')) {
    const model = equipment.replace('thermomix_', '') as ThermomixModel;
    return { type: 'thermomix', model };
  }
  return { type: equipment as EquipmentType };
}

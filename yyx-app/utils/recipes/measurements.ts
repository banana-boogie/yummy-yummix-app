import { MeasurementUnit } from '@/types/recipe.types';
import i18n from '@/i18n';

// Conversion factors between units
const CONVERSIONS = {
  weight: {
    metric: {
      g: { to: 'oz', factor: 0.03527396 },
      kg: { to: 'lb', factor: 2.20462262 }
    },
    imperial: {
      oz: { to: 'g', factor: 28.3495 },
      lb: { to: 'kg', factor: 0.453592 }
    }
  },
  volume: {
    metric: {
      ml: { to: 'fl_oz', factor: 0.033814 },
      l: { to: 'cup', factor: 4.16667 }
    },
    imperial: {
      fl_oz: { to: 'ml', factor: 29.5735 },
      cup: { to: 'l', factor: 0.24 },
    }
  }
} as const;

// Common fractions for tsp/tbsp measurements
const FRACTIONS = {
  0.125: "⅛",
  0.25: "¼",
  0.33: "⅓",
  0.375: "⅜",
  0.5: "½",
  0.625: "⅝",
  0.66: "⅔",
  0.67: "⅔", // Alternative for 2/3
  0.75: "¾",
  0.875: "⅞"
} as const;

export function formatIngredientQuantity(value: number | string, unit?: string): string {
  // Convert string values to numbers
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Handle NaN values
  if (isNaN(numValue)) {
    console.warn('An invalid number was inputted in the formatIngredientQuantity', value)
    return '0';
  }

  // If unit is undefined, just return formatted number
  if (!unit) {
    return numValue.toFixed(1).replace(/\.0$/, '');
  }

  // Only use fractions for tsp and tbsp
  if (unit === 'tsp' || unit === 'tbsp' || unit === 'tsp.' || unit === 'tbsp.') {
    if (!Number.isInteger(numValue)) {
      const decimal = numValue % 1;
      const whole = Math.floor(numValue);

      const closestFraction = Object.entries(FRACTIONS).reduce((closest, [dec, frac]) => {
        return Math.abs(Number(dec) - decimal) < Math.abs(Number(closest[0]) - decimal)
          ? [dec, frac]
          : closest;
      })[1];

      return whole ? `${whole} ${closestFraction}` : closestFraction;
    }
  }

  // For all other units, use decimal format with one decimal place
  return numValue.toFixed(1).replace(/\.0$/, '');
}

type SystemType = 'metric' | 'imperial' | 'universal';
type MeasurementType = 'weight' | 'volume' | 'unit';

function getUnitInfo(system: SystemType, type: MeasurementType, unitId: string) {
  return {
    name: i18n.t(`measurementUnits.${system}.${type}.${unitId}.name`),
    namePlural: i18n.t(`measurementUnits.${system}.${type}.${unitId}.namePlural`),
    symbol: i18n.t(`measurementUnits.${system}.${type}.${unitId}.symbol`)
  };
}

type ConversionType = typeof CONVERSIONS;
type MeasurementSystem = 'metric' | 'imperial';
type MeasurementTypes = keyof ConversionType;
type UnitId = keyof ConversionType[MeasurementTypes][MeasurementSystem];

type ConversionFactor = { to: string; factor: number };

export function convertMeasurement(
  quantity: number,
  unit: MeasurementUnit,
  targetSystem: 'metric' | 'imperial' | 'universal'
): { quantity: number, unit: MeasurementUnit } {
  // Don't convert universal units
  if (unit.system === 'universal' || unit.system === targetSystem) {
    return { quantity, unit };
  }

  const conversion = CONVERSIONS[unit.type as MeasurementTypes]
    ?.[unit.system as MeasurementSystem]
    ?.[unit.id as UnitId] as ConversionFactor;

  if (!conversion) return { quantity, unit };

  const convertedQuantity = quantity * conversion.factor;
  const targetUnitId = conversion.to;
  const unitInfo = getUnitInfo(targetSystem, unit.type, targetUnitId);

  if (!unitInfo) return { quantity, unit };

  return {
    quantity: convertedQuantity,
    unit: {
      id: targetUnitId,
      type: unit.type,
      system: targetSystem,
      name: unitInfo.name,
      symbol: unitInfo.symbol
    } as MeasurementUnit
  };
}

export function formatMeasurement(
  quantity: number,
  unit: MeasurementUnit,
  targetSystem: 'metric' | 'imperial'
): { quantity: string, unit: string } {

  // Helper to get correct unit display based on quantity
  const getUnitDisplay = (u: MeasurementUnit, qty: number): string => {
    // Use plural for quantities that are not exactly 1
    if (qty !== 1 && u.symbolPlural && u.symbolPlural.trim() !== '') {
      return u.symbolPlural;
    }
    // Fall back to symbol for singular
    return u.symbol;
  };

  if (unit.system === 'universal') {
    const formattedQty = formatIngredientQuantity(quantity, unit.id);
    return {
      quantity: formattedQty,
      unit: getUnitDisplay(unit, quantity)
    };
  }

  const converted = convertMeasurement(quantity, unit, targetSystem);

  return {
    quantity: formatIngredientQuantity(converted.quantity, converted.unit.id),
    unit: getUnitDisplay(converted.unit, converted.quantity)
  };
}
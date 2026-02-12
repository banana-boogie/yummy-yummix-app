import i18n from '@/i18n';
import { MeasurementUnit } from '@/types/recipe.types';

// Raw Supabase join types (use index signatures for locale-dynamic keys)
interface RawIngredientJoin {
    id: string;
    picture_url?: string;
    [key: string]: unknown;
}

interface RawMeasurementUnitJoin {
    id: string;
    type: string;
    system: string;
    [key: string]: unknown;
}

export interface MappedIngredientFields {
    name: string;
    pluralName?: string;
    pictureUrl?: string;
}

export function getLanguageSuffix(): string {
    return `_${i18n.locale}`;
}

export function mapIngredient(
    ingredient: RawIngredientJoin | null | undefined,
    langSuffix: string,
    fallbackName?: string,
): MappedIngredientFields {
    return {
        name: (ingredient?.[`name${langSuffix}`] as string) ?? fallbackName ?? '',
        pluralName: ingredient?.[`plural_name${langSuffix}`] as string | undefined,
        pictureUrl: ingredient?.picture_url as string | undefined,
    };
}

export function mapMeasurementUnit(
    unit: RawMeasurementUnitJoin | null | undefined,
    langSuffix: string,
): MeasurementUnit | undefined {
    if (!unit) return undefined;
    return {
        id: unit.id,
        type: unit.type,
        system: unit.system,
        name: unit[`name${langSuffix}`] as string,
        symbol: unit[`symbol${langSuffix}`] as string,
    } as MeasurementUnit;
}
